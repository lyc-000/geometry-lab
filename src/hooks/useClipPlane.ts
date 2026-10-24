import { useMemo } from 'react';
import { Plane, Vector3 } from 'three';
import { parsePlaneEquation, type ParsedPlane } from '../lib/relation';
import { useStudioStore } from '../store/useStudioStore';
import type { ClipKeepSide } from '../types';

export interface ClipPlaneState {
  parsed: ParsedPlane | null;
  plane: Plane | null;
  point: Vector3 | null;
  normal: Vector3 | null;
  keepSide: ClipKeepSide;
  error: string | null;
}

export function useClipPlane(): ClipPlaneState {
  const equation = useStudioStore((state) => state.clipEquation);
  const keepSide = useStudioStore((state) => state.clipKeepSide);

  return useMemo(() => {
    try {
      const parsed = parsePlaneEquation(equation);
      const sign = keepSide === 'positive' ? 1 : -1;
      const normal = new Vector3(
        parsed.normal[0] * sign,
        parsed.normal[1] * sign,
        parsed.normal[2] * sign,
      );
      const constant = parsed.constant * sign;
      const plane = new Plane(normal, constant);
      const point = normal.clone().multiplyScalar(-constant);
      return { parsed, plane, point, normal, keepSide, error: null };
    } catch (error) {
      return {
        parsed: null,
        plane: null,
        point: null,
        normal: null,
        keepSide,
        error: error instanceof Error ? error.message : '平面方程无效。',
      };
    }
  }, [equation, keepSide]);
}
