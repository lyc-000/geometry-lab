import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type {
  Axis,
  ImplicitMeshPayload,
  ProjectionPlane,
  SerializedGeometry,
  Vec3,
} from '../types';

export interface GeometryStats {
  vertexCount: number;
  triangleCount: number;
}

export function getGeometryStats(geometry: BufferGeometry): GeometryStats {
  const position = geometry.getAttribute('position');
  if (!position) return { vertexCount: 0, triangleCount: 0 };
  const index = geometry.getIndex();
  return {
    vertexCount: position.count,
    triangleCount: Math.floor((index ? index.count : position.count) / 3),
  };
}

export function createSphereSolid(center: Vec3, radius: number): BufferGeometry {
  const geometry = new SphereGeometry(radius, 64, 40);
  geometry.translate(center[0], center[1], center[2]);
  geometry.computeVertexNormals();
  finalizeGeometry(geometry);
  return geometry;
}

export function createCylinderSolid(
  center: Vec3,
  radius: number,
  height: number,
  axis: Axis,
): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius, height, 72, 4, false);
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  if (axis === 'x') geometry.rotateZ(-Math.PI / 2);
  geometry.translate(center[0], center[1], center[2]);
  geometry.computeVertexNormals();
  finalizeGeometry(geometry);
  return geometry;
}

export function createBoxSolid(center: Vec3, size: Vec3): BufferGeometry {
  const geometry = new BoxGeometry(size[0], size[1], size[2]);
  geometry.translate(center[0], center[1], center[2]);
  geometry.computeVertexNormals();
  finalizeGeometry(geometry);
  return geometry;
}

export function createBufferGeometryFromData(
  positions: Float32Array,
  normals: Float32Array | null,
  indices: Uint32Array | null,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  if (indices && indices.length > 0) {
    geometry.setIndex(new BufferAttribute(indices, 1));
  }
  if (normals && normals.length > 0) {
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  finalizeGeometry(geometry);
  return geometry;
}

export function createImplicitGeometry(payload: ImplicitMeshPayload): BufferGeometry {
  return createBufferGeometryFromData(payload.positions, payload.normals, payload.indices);
}

export function finalizeGeometry(geometry: BufferGeometry): void {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function createProjectionGeometry(
  source: BufferGeometry,
  plane: ProjectionPlane,
): BufferGeometry {
  const position = source.getAttribute('position');
  if (!position) {
    throw new Error('源几何体缺少顶点数据。');
  }

  const flattened = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    flattened[i * 3] = plane === 'YOZ' ? 0 : x;
    flattened[i * 3 + 1] = plane === 'XOZ' ? 0 : y;
    flattened[i * 3 + 2] = plane === 'XOY' ? 0 : z;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(flattened, 3));
  const index = source.getIndex();
  if (index) {
    geometry.setIndex(index.clone());
  }
  finalizeGeometry(geometry);
  return geometry;
}

export function createHalfSpaceGeometry(
  normal: Vec3,
  point: Vec3,
  size = 120,
): BufferGeometry {
  // A very large watertight box, translated so one face lies exactly on the
  // clip plane and the volume extends toward the retained side. Intersecting a
  // solid with it is a robust way to bake a visual clipping plane into CSG.
  const geometry = new BoxGeometry(size, size, size);
  geometry.translate(0, 0, size / 2);

  const localNormal = new Vector3(0, 0, 1);
  const targetNormal = new Vector3(normal[0], normal[1], normal[2]).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(localNormal, targetNormal);
  const matrix = new Matrix4().makeRotationFromQuaternion(quaternion);
  matrix.setPosition(new Vector3(point[0], point[1], point[2]));
  geometry.applyMatrix4(matrix);
  geometry.computeVertexNormals();
  finalizeGeometry(geometry);
  return geometry;
}

export function serializeGeometry(geometry: BufferGeometry): SerializedGeometry {
  const position = geometry.getAttribute('position');
  if (!position) {
    throw new Error('几何体缺少 position 顶点属性。');
  }

  let normal = geometry.getAttribute('normal');
  if (!normal) {
    geometry.computeVertexNormals();
    normal = geometry.getAttribute('normal');
  }

  const index = geometry.getIndex();
  return {
    positions: new Float32Array(position.array as ArrayLike<number>),
    normals: normal
      ? new Float32Array(normal.array as ArrayLike<number>)
      : null,
    indices: index
      ? new Uint32Array(index.array as ArrayLike<number>)
      : null,
  };
}

export function getGeometryBounds(geometry: BufferGeometry): Box3 {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return geometry.boundingBox?.clone() ?? new Box3();
}

export function isFiniteGeometry(geometry: BufferGeometry): boolean {
  const position = geometry.getAttribute('position');
  if (!position) return false;
  const array = position.array;
  for (let i = 0; i < array.length; i += 1) {
    if (!Number.isFinite(array[i])) return false;
  }
  return position.count > 0;
}

export function buildLocalFrameForPlane(normal: Vec3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    new Vector3(normal[0], normal[1], normal[2]).normalize(),
  );
}
