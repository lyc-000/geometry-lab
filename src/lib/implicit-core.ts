import isosurface from 'isosurface';
import { EquationError, parseRelation } from './relation';
import type { ImplicitMeshPayload, Vec3, WorkerErrorCode } from '../types';

export interface ImplicitGenerationRequest {
  expression: string;
  resolution: number;
  domain: [Vec3, Vec3];
}

export class ImplicitGenerationError extends Error {
  readonly code: WorkerErrorCode;

  constructor(code: WorkerErrorCode, message: string) {
    super(message);
    this.name = 'ImplicitGenerationError';
    this.code = code;
  }
}

const BOUNDARY_STEPS = 17;
const MIN_RESOLUTION = 16;
const MAX_RESOLUTION = 72;

function validateDomain(domain: [Vec3, Vec3]): void {
  if (!Array.isArray(domain) || domain.length !== 2) {
    throw new ImplicitGenerationError('INVALID_DOMAIN', '采样范围格式不正确。');
  }
  for (let axis = 0; axis < 3; axis += 1) {
    const low = domain[0][axis];
    const high = domain[1][axis];
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      throw new ImplicitGenerationError('INVALID_DOMAIN', '采样范围的每个坐标都必须是有限数值。');
    }
    if (high <= low) {
      throw new ImplicitGenerationError('INVALID_DOMAIN', '采样范围的最大值必须大于最小值。');
    }
    if (high - low > 200) {
      throw new ImplicitGenerationError('INVALID_DOMAIN', '采样范围过大（单轴跨度需 ≤ 200）。');
    }
  }
}

function boundarySignature(
  raw: (x: number, y: number, z: number) => number,
  domain: [Vec3, Vec3],
): { positive: number; negative: number; zero: number } {
  const [low, high] = domain;
  let positive = 0;
  let negative = 0;
  let zero = 0;
  const tolerance = 1e-7;

  const classify = (value: number): void => {
    if (!Number.isFinite(value)) {
      throw new EquationError('NON_FINITE', '方程在采样边界上产生了非有限数值。请检查定义域。');
    }
    if (value > tolerance) positive += 1;
    else if (value < -tolerance) negative += 1;
    else zero += 1;
  };

  for (let face = 0; face < 6; face += 1) {
    const fixedAxis = Math.floor(face / 2);
    const fixedValue = face % 2 === 0 ? low[fixedAxis] : high[fixedAxis];
    const axisA = (fixedAxis + 1) % 3;
    const axisB = (fixedAxis + 2) % 3;

    for (let i = 0; i <= BOUNDARY_STEPS; i += 1) {
      for (let j = 0; j <= BOUNDARY_STEPS; j += 1) {
        const point: Vec3 = [0, 0, 0];
        point[fixedAxis] = fixedValue;
        point[axisA] = low[axisA] + ((high[axisA] - low[axisA]) * i) / BOUNDARY_STEPS;
        point[axisB] = low[axisB] + ((high[axisB] - low[axisB]) * j) / BOUNDARY_STEPS;
        classify(raw(point[0], point[1], point[2]));
      }
    }
  }

  return { positive, negative, zero };
}

interface GridPotential {
  potential: (x: number, y: number, z: number) => number;
  insideSamples: number;
  cacheSize: number;
}

function buildGridPotential(
  relationRaw: (x: number, y: number, z: number) => number,
  domain: [Vec3, Vec3],
  dims: [number, number, number],
  fieldSign: 1 | -1,
): GridPotential {
  const [low, high] = domain;
  const scale: Vec3 = [
    (high[0] - low[0]) / dims[0],
    (high[1] - low[1]) / dims[1],
    (high[2] - low[2]) / dims[2],
  ];
  const cache = new Map<number, number>();
  const strideY = dims[0];
  const strideZ = dims[0] * dims[1];
  let insideSamples = 0;

  const evaluate = (ix: number, iy: number, iz: number): number => {
    const key = ix + iy * strideY + iz * strideZ;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const x = low[0] + ix * scale[0];
    const y = low[1] + iy * scale[1];
    const z = low[2] + iz * scale[2];
    const value = relationRaw(x, y, z);
    if (!Number.isFinite(value)) {
      throw new ImplicitGenerationError(
        'NON_FINITE',
        `方程在点 (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) 处不是有限实数。请调整定义域或方程。`,
      );
    }
    const signedValue = fieldSign * value;
    cache.set(key, signedValue);
    if (signedValue > 0) insideSamples += 1;
    return signedValue;
  };

  const potential = (x: number, y: number, z: number): number => {
    const ix = Math.min(dims[0] - 1, Math.max(0, Math.round((x - low[0]) / scale[0])));
    const iy = Math.min(dims[1] - 1, Math.max(0, Math.round((y - low[1]) / scale[1])));
    const iz = Math.min(dims[2] - 1, Math.max(0, Math.round((z - low[2]) / scale[2])));
    return evaluate(ix, iy, iz);
  };

  return {
    potential,
    get insideSamples() {
      return insideSamples;
    },
    get cacheSize() {
      return cache.size;
    },
  } as GridPotential;
}

function orientAndValidate(
  rawPositions: [number, number, number][],
  rawCells: [number, number, number][],
): {
  positions: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  vertexCount: number;
  bounds: { min: Vec3; max: Vec3 };
} {
  if (rawPositions.length === 0 || rawCells.length === 0) {
    throw new ImplicitGenerationError(
      'EMPTY_SURFACE',
      '未找到满足条件的实体区域。请检查方程/不等号方向，或扩大采样范围、提高采样精度。',
    );
  }

  const positions: [number, number, number][] = [];
  const remap = new Int32Array(rawPositions.length);
  const vertexMap = new Map<string, number>();

  for (let i = 0; i < rawPositions.length; i += 1) {
    const source = rawPositions[i];
    const qx = Math.round(source[0] * 1e6) / 1e6;
    const qy = Math.round(source[1] * 1e6) / 1e6;
    const qz = Math.round(source[2] * 1e6) / 1e6;
    const key = `${qx},${qy},${qz}`;
    let index = vertexMap.get(key);
    if (index === undefined) {
      index = positions.length;
      vertexMap.set(key, index);
      positions.push([qx, qy, qz]);
    }
    remap[i] = index;
  }

  const triangles: [number, number, number][] = [];
  for (const [a, b, c] of rawCells) {
    const ia = remap[a];
    const ib = remap[b];
    const ic = remap[c];
    if (ia === undefined || ib === undefined || ic === undefined) continue;
    if (ia === ib || ib === ic || ia === ic) continue;
    triangles.push([ia, ib, ic]);
  }

  if (triangles.length < 4) {
    throw new ImplicitGenerationError(
      'EMPTY_SURFACE',
      '等值面过于稀疏，未形成有效实体。请提高采样精度或调整采样范围。',
    );
  }

  const vertexCount = positions.length;
  const edgeMap = new Map<number, { count: number; balance: number }>();
  for (const [a, b, c] of triangles) {
    const edges: [number, number][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [from, to] of edges) {
      const key = from < to ? from * vertexCount + to : to * vertexCount + from;
      const record = edgeMap.get(key) ?? { count: 0, balance: 0 };
      record.count += 1;
      record.balance += from < to ? 1 : -1;
      edgeMap.set(key, record);
    }
  }

  let badEdges = 0;
  for (const record of edgeMap.values()) {
    if (record.count !== 2 || record.balance !== 0) badEdges += 1;
  }
  if (badEdges > 0) {
    throw new ImplicitGenerationError(
      'NON_MANIFOLD',
      `等值面未形成水密网格（检测到 ${badEdges} 条非流形/开口边）。方程可能不封闭，或实体触碰到采样边界。请扩大采样范围、提高精度，或改用明确的不等式。`,
    );
  }

  let signedVolume = 0;
  for (const [a, b, c] of triangles) {
    const pa = positions[a];
    const pb = positions[b];
    const pc = positions[c];
    signedVolume +=
      (pa[0] * (pb[1] * pc[2] - pb[2] * pc[1]) +
        pa[1] * (pb[2] * pc[0] - pb[0] * pc[2]) +
        pa[2] * (pb[0] * pc[1] - pb[1] * pc[0])) /
      6;
  }

  if (!Number.isFinite(signedVolume) || Math.abs(signedVolume) < 1e-9) {
    throw new ImplicitGenerationError(
      'ZERO_VOLUME',
      '生成的等值面未包围有效体积。请确认方程表示的是一个封闭实体。',
    );
  }

  if (signedVolume < 0) {
    for (const triangle of triangles) {
      const tmp = triangle[1];
      triangle[1] = triangle[2];
      triangle[2] = tmp;
    }
    signedVolume = -signedVolume;
  }

  const flatPositions = new Float32Array(vertexCount * 3);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertexCount; i += 1) {
    const point = positions[i];
    for (let axis = 0; axis < 3; axis += 1) {
      flatPositions[i * 3 + axis] = point[axis];
      if (point[axis] < min[axis]) min[axis] = point[axis];
      if (point[axis] > max[axis]) max[axis] = point[axis];
    }
  }

  const flatIndices = new Uint32Array(triangles.length * 3);
  for (let i = 0; i < triangles.length; i += 1) {
    flatIndices[i * 3] = triangles[i][0];
    flatIndices[i * 3 + 1] = triangles[i][1];
    flatIndices[i * 3 + 2] = triangles[i][2];
  }

  return {
    positions: flatPositions,
    indices: flatIndices,
    triangleCount: triangles.length,
    vertexCount,
    bounds: { min, max },
  };
}

function computeSmoothNormals(
  positions: Float32Array,
  indices: Uint32Array,
  vertexCount: number,
): Float32Array {
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const by = positions[b * 3 + 1];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cy = positions[c * 3 + 1];
    const cz = positions[c * 3 + 2];
    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const index of [a, b, c]) {
      normals[index * 3] += nx;
      normals[index * 3 + 1] += ny;
      normals[index * 3 + 2] += nz;
    }
  }

  for (let i = 0; i < vertexCount; i += 1) {
    const x = normals[i * 3];
    const y = normals[i * 3 + 1];
    const z = normals[i * 3 + 2];
    const length = Math.hypot(x, y, z);
    if (length > 1e-12) {
      normals[i * 3] = x / length;
      normals[i * 3 + 1] = y / length;
      normals[i * 3 + 2] = z / length;
    } else {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 0;
      normals[i * 3 + 2] = 1;
    }
  }

  return normals;
}

export function generateImplicitMesh(request: ImplicitGenerationRequest): ImplicitMeshPayload {
  const relation = parseRelation(request.expression);
  const domain: [Vec3, Vec3] = [
    [...request.domain[0]] as Vec3,
    [...request.domain[1]] as Vec3,
  ];
  validateDomain(domain);

  const resolution = Math.round(request.resolution);
  if (!Number.isFinite(resolution) || resolution < MIN_RESOLUTION || resolution > MAX_RESOLUTION) {
    throw new ImplicitGenerationError(
      'INVALID_DOMAIN',
      `采样精度需在 ${MIN_RESOLUTION}–${MAX_RESOLUTION} 之间。`,
    );
  }

  const boundary = boundarySignature(relation.raw, domain);
  let fieldSign: 1 | -1;

  if (relation.isInequality) {
    fieldSign = relation.insideSign ?? -1;
    const insideAtBoundary = fieldSign > 0 ? boundary.positive : boundary.negative;
    if (insideAtBoundary > 0) {
      throw new ImplicitGenerationError(
        'OPEN_SURFACE',
        '实体延伸到采样范围之外，无法保证网格封闭。请扩大采样范围后重试（当前范围与方程给出的实体相交于边界）。',
      );
    }
  } else {
    if (boundary.positive > 0 && boundary.negative > 0) {
      throw new ImplicitGenerationError(
        'OPEN_SURFACE',
        '该方程对应的曲面不是封闭等值面，或实体超出采样范围。单叶双曲面、平面等无界曲面不能直接参与 CSG。请改用封闭的不等式，或扩大/调整采样范围。',
      );
    }
    if (boundary.positive === 0 && boundary.negative === 0) {
      throw new ImplicitGenerationError(
        'UNDEFINED',
        '方程在采样边界上全部为零，无法判断实体内外。请更换方程或范围。',
      );
    }
    fieldSign = boundary.negative > 0 ? 1 : -1;
  }

  const dims: [number, number, number] = [resolution, resolution, resolution];
  const grid = buildGridPotential(relation.raw, domain, dims, fieldSign);

  let extracted: ReturnType<typeof isosurface.marchingCubes>;
  try {
    extracted = isosurface.marchingCubes(dims, grid.potential, domain);
  } catch (error) {
    if (error instanceof ImplicitGenerationError || error instanceof EquationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ImplicitGenerationError(
      'UNKNOWN',
      `等值面提取失败：${message}。请降低采样精度或缩小采样范围后重试。`,
    );
  }

  const mesh = orientAndValidate(
    extracted.positions as [number, number, number][],
    extracted.cells as [number, number, number][],
  );

  if (grid.insideSamples === 0) {
    throw new ImplicitGenerationError(
      'EMPTY_SURFACE',
      '采样网格中没有找到实体内部。请检查不等号方向，或调整采样范围。',
    );
  }

  const normals = computeSmoothNormals(mesh.positions, mesh.indices, mesh.vertexCount);

  return {
    positions: mesh.positions,
    normals,
    indices: mesh.indices,
    triangleCount: mesh.triangleCount,
    vertexCount: mesh.vertexCount,
    bounds: mesh.bounds,
    grid: dims,
    insideSamples: grid.insideSamples,
  };
}
