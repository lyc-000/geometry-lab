import type { ProjectionPlane, SolidKind } from '../types';

export const OBJECT_PALETTE = [
  '#67b7ff',
  '#ffb15e',
  '#bda0ff',
  '#62e0b2',
  '#ff8b9d',
  '#82d4ff',
  '#ffd166',
] as const;

export const RESULT_COLOR = '#a8a2ff';
export const ACCENT = '#8de6c2';

export const PROJECTION_COLORS: Record<ProjectionPlane, string> = {
  XOY: '#72e6c3',
  YOZ: '#b6a4ff',
  XOZ: '#ffd06b',
};

export const PLANE_COLORS: Record<ProjectionPlane, string> = PROJECTION_COLORS;

export const KIND_LABELS: Record<SolidKind, string> = {
  sphere: '球体',
  cylinder: '圆柱体',
  box: '长方体',
  implicit: '隐式等值面',
  csg: '布尔实体',
  clip: '剖切实体',
};

export const OPERATION_LABELS: Record<'subtract' | 'intersect' | 'union', string> = {
  subtract: '差集',
  intersect: '交集',
  union: '并集',
};

export function pickObjectColor(index: number): string {
  return OBJECT_PALETTE[index % OBJECT_PALETTE.length];
}
