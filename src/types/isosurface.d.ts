declare module 'isosurface' {
  export type Vec3 = [number, number, number];

  export interface IsosurfaceMesh {
    positions: Vec3[];
    cells: [number, number, number][];
  }

  export type Potential = (x: number, y: number, z: number) => number;

  export function marchingCubes(
    dims: [number, number, number],
    potential: Potential,
    bounds?: [Vec3, Vec3],
  ): IsosurfaceMesh;

  export function marchingTetrahedra(
    dims: [number, number, number],
    potential: Potential,
    bounds?: [Vec3, Vec3],
  ): IsosurfaceMesh;

  export function surfaceNets(
    dims: [number, number, number],
    potential: Potential,
    bounds?: [Vec3, Vec3],
  ): IsosurfaceMesh;

  const isosurface: {
    marchingCubes: typeof marchingCubes;
    marchingTetrahedra: typeof marchingTetrahedra;
    surfaceNets: typeof surfaceNets;
  };
  export default isosurface;
}
