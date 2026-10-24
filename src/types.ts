import type { BufferGeometry } from 'three';

export type Vec3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type SolidKind = 'sphere' | 'cylinder' | 'box' | 'implicit' | 'csg' | 'clip';
export type PrimitiveKind = 'sphere' | 'cylinder' | 'box' | 'implicit';
export type BooleanOperation = 'subtract' | 'intersect' | 'union';
export type ProjectionPlane = 'XOY' | 'YOZ' | 'XOZ';
export type RightTab = 'clip' | 'boolean' | 'projection';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top';
export type ClipKeepSide = 'positive' | 'negative';

export interface SolidMeta {
  equation?: string;
  latex?: string;
  domain?: [Vec3, Vec3];
  resolution?: number;
  operation?: BooleanOperation;
  sourceNames?: string[];
  sourceName?: string;
  axis?: Axis;
  params?: Record<string, number | string>;
  algorithm?: string;
  note?: string;
}

export interface SolidObject {
  id: string;
  name: string;
  label: string;
  kind: SolidKind;
  color: string;
  geometry: BufferGeometry;
  triangleCount: number;
  vertexCount: number;
  visible: boolean;
  createdAt: number;
  meta: SolidMeta;
}

export interface NewSolid {
  label: string;
  kind: SolidKind;
  geometry: BufferGeometry;
  triangleCount: number;
  vertexCount: number;
  meta?: SolidMeta;
  visible?: boolean;
  color?: string;
}

export interface ProjectionLayer {
  id: string;
  sourceObjectId: string;
  sourceName: string;
  sourceLabel: string;
  plane: ProjectionPlane;
  color: string;
  geometry: BufferGeometry;
  triangleCount: number;
  vertexCount: number;
  visible: boolean;
  createdAt: number;
}

export interface OverlapPreview {
  geometry: BufferGeometry;
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  triangleCount: number;
  vertexCount: number;
  createdAt: number;
}

export interface ToastMessage {
  id: string;
  variant: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

export interface BusyState {
  title: string;
  detail?: string;
}

export interface ImplicitMeshPayload {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  vertexCount: number;
  bounds: { min: Vec3; max: Vec3 };
  grid: [number, number, number];
  insideSamples: number;
}

export interface SerializedGeometry {
  positions: Float32Array;
  normals: Float32Array | null;
  indices: Uint32Array | null;
}

export interface CsgResultPayload extends SerializedGeometry {
  triangleCount: number;
  vertexCount: number;
}

export type WorkerErrorCode =
  | 'PARSE_ERROR'
  | 'UNDEFINED'
  | 'OPEN_SURFACE'
  | 'NON_FINITE'
  | 'EMPTY_SURFACE'
  | 'NON_MANIFOLD'
  | 'ZERO_VOLUME'
  | 'INVALID_DOMAIN'
  | 'INVALID_GEOMETRY'
  | 'EMPTY_RESULT'
  | 'WORKER_ERROR'
  | 'UNKNOWN';

export interface WorkerErrorPayload {
  code: WorkerErrorCode | string;
  message: string;
}
