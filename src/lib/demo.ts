import { createCylinderSolid, createSphereSolid, getGeometryStats } from './geometry';
import { makeId } from './utils';
import type { SolidObject, Vec3 } from '../types';

export function createDemoObjects(): SolidObject[] {
  const sphereCenter: Vec3 = [-0.95, 0, 2.15];
  const sphereGeometry = createSphereSolid(sphereCenter, 2.05);
  const sphereStats = getGeometryStats(sphereGeometry);

  const cylinderCenter: Vec3 = [1.0, 0, 2.15];
  const cylinderGeometry = createCylinderSolid(cylinderCenter, 1.35, 4.3, 'z');
  const cylinderStats = getGeometryStats(cylinderGeometry);

  return [
    {
      id: makeId('solid'),
      name: 'A',
      label: '球体',
      kind: 'sphere',
      color: '#67b7ff',
      geometry: sphereGeometry,
      triangleCount: sphereStats.triangleCount,
      vertexCount: sphereStats.vertexCount,
      visible: true,
      createdAt: Date.now(),
      meta: {
        params: {
          center: '(-0.95, 0, 2.15)',
          radius: '2.05',
        },
      },
    },
    {
      id: makeId('solid'),
      name: 'B',
      label: '圆柱体',
      kind: 'cylinder',
      color: '#ffb15e',
      geometry: cylinderGeometry,
      triangleCount: cylinderStats.triangleCount,
      vertexCount: cylinderStats.vertexCount,
      visible: true,
      createdAt: Date.now() + 1,
      meta: {
        axis: 'z',
        params: {
          center: '(1, 0, 2.15)',
          radius: '1.35',
          height: '4.3',
        },
      },
    },
  ];
}
