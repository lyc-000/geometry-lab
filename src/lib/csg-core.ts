import * as THREE from 'three';
import {
  ADDITION,
  Brush,
  Evaluator,
  INTERSECTION,
  SUBTRACTION,
} from 'three-bvh-csg';
import type {
  BooleanOperation,
  CsgResultPayload,
  SerializedGeometry,
  WorkerErrorCode,
} from '../types';

export interface CsgCoreRequest {
  operation: BooleanOperation;
  a: SerializedGeometry;
  b: SerializedGeometry;
}

export class CsgCoreError extends Error {
  readonly code: WorkerErrorCode;

  constructor(code: WorkerErrorCode, message: string) {
    super(message);
    this.name = 'CsgCoreError';
    this.code = code;
  }
}

function assertSerializedGeometry(data: SerializedGeometry, label: string): void {
  if (!data || !(data.positions instanceof Float32Array)) {
    throw new CsgCoreError('INVALID_GEOMETRY', `对象 ${label} 缺少有效的顶点数据。`);
  }
  if (data.positions.length === 0 || data.positions.length % 3 !== 0) {
    throw new CsgCoreError('INVALID_GEOMETRY', `对象 ${label} 的顶点流不完整。`);
  }
  const vertexCount = data.positions.length / 3;
  const indexCount = data.indices ? data.indices.length : vertexCount;
  if (indexCount === 0 || indexCount % 3 !== 0) {
    throw new CsgCoreError('INVALID_GEOMETRY', `对象 ${label} 的三角面数据无效。`);
  }
  if (vertexCount < 4) {
    throw new CsgCoreError('INVALID_GEOMETRY', `对象 ${label} 的面数过少，无法参与布尔运算。`);
  }
}

function buildBrush(
  data: SerializedGeometry,
  label: string,
): { brush: Brush; geometry: THREE.BufferGeometry } {
  assertSerializedGeometry(data, label);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  if (data.normals && data.normals.length === data.positions.length) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  if (data.indices) {
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial();
  const brush = new Brush(geometry, material);
  // The geometry has already been baked into world space. Updating the matrix
  // world is still essential: three-bvh-csg reads world-space BVH data, and a
  // stale matrix world silently shifts the cut.
  brush.updateMatrixWorld(true);
  return { brush, geometry };
}

function extractPositions(data: Float32Array, label: string): Float32Array {
  for (let i = 0; i < data.length; i += 1) {
    if (!Number.isFinite(data[i])) {
      throw new CsgCoreError(
        'INVALID_GEOMETRY',
        `对象 ${label} 含有非有限坐标，无法进行运算。`,
      );
    }
  }
  return data;
}

function operationFromName(operation: BooleanOperation) {
  switch (operation) {
    case 'subtract':
      return SUBTRACTION;
    case 'intersect':
      return INTERSECTION;
    case 'union':
      return ADDITION;
    default:
      throw new CsgCoreError('UNKNOWN', '未知的布尔运算类型。');
  }
}

export function evaluateCsg(request: CsgCoreRequest): CsgResultPayload {
  extractPositions(request.a.positions, 'A');
  extractPositions(request.b.positions, 'B');
  const a = buildBrush(request.a, 'A');
  const b = buildBrush(request.b, 'B');

  let result: Brush;
  try {
    const evaluator = new Evaluator();
    evaluator.attributes = ['position', 'normal'];
    evaluator.useGroups = false;

    result = evaluator.evaluate(
      a.brush,
      b.brush,
      operationFromName(request.operation),
      new Brush(),
    );
    result.updateMatrixWorld(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CsgCoreError(
      'UNKNOWN',
      `布尔运算失败：${message}。请确认两个对象都是封闭水密网格，并避免输入退化三角面。`,
    );
  }

  const resultGeometry = result.geometry;
  const resultPosition = resultGeometry.getAttribute('position') as
    | THREE.BufferAttribute
    | undefined;
  const resultIndex = resultGeometry.getIndex();

  if (!resultPosition || resultPosition.count === 0) {
    throw new CsgCoreError(
      'EMPTY_RESULT',
      '布尔运算结果为空（两个实体没有满足条件的公共/剩余区域）。请调整对象或运算类型。',
    );
  }

  const triangleCount = Math.floor(
    (resultIndex ? resultIndex.count : resultPosition.count) / 3,
  );
  if (triangleCount === 0) {
    throw new CsgCoreError(
      'EMPTY_RESULT',
      '布尔运算没有生成有效三角面。请调整对象位置或运算类型。',
    );
  }

  let normals: Float32Array | null = null;
  const normalAttribute = resultGeometry.getAttribute('normal') as
    | THREE.BufferAttribute
    | undefined;
  if (normalAttribute && normalAttribute.count === resultPosition.count) {
    normals = new Float32Array(normalAttribute.array as ArrayLike<number>);
  }

  const positions = new Float32Array(resultPosition.array as ArrayLike<number>);
  extractPositions(positions, '结果');
  const indices = resultIndex
    ? new Uint32Array(resultIndex.array as ArrayLike<number>)
    : null;

  // Free BVH caches and geometry references before the worker returns.
  a.brush.disposeCacheData?.();
  b.brush.disposeCacheData?.();
  result.disposeCacheData?.();
  a.geometry.dispose();
  b.geometry.dispose();
  resultGeometry.dispose();

  return {
    positions,
    normals,
    indices,
    triangleCount,
    vertexCount: positions.length / 3,
  };
}
