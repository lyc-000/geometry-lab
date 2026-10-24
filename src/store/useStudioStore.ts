import { create } from 'zustand';
import type { BufferGeometry } from 'three';
import {
  OBJECT_PALETTE,
  PROJECTION_COLORS,
} from '../lib/colors';
import { createDemoObjects } from '../lib/demo';
import {
  describeKind,
  makeId,
  nextObjectName,
} from '../lib/utils';
import type {
  BooleanOperation,
  BusyState,
  CameraPreset,
  ClipKeepSide,
  NewSolid,
  PrimitiveKind,
  OverlapPreview,
  ProjectionLayer,
  ProjectionPlane,
  RightTab,
  SolidObject,
  ToastMessage,
} from '../types';

export interface NewProjectionInput {
  sourceObjectId: string;
  plane: ProjectionPlane;
  geometry: BufferGeometry;
  triangleCount: number;
  vertexCount: number;
}

export interface StudioState {
  objects: SolidObject[];
  projections: ProjectionLayer[];
  selectedId: string | null;
  hoveredId: string | null;
  rightTab: RightTab;
  creationMode: PrimitiveKind;

  clipEquation: string;
  clipEnabled: boolean;
  clipKeepSide: ClipKeepSide;
  showClipHelper: boolean;

  csgA: string | null;
  csgB: string | null;
  csgOperation: BooleanOperation;
  overlapPreview: OverlapPreview | null;

  projectionOpacity: number;

  cameraPreset: CameraPreset;
  cameraSequence: number;
  cameraFitSequence: number;

  busy: BusyState | null;
  toasts: ToastMessage[];

  addSolid: (input: NewSolid) => SolidObject;
  removeObject: (id: string) => void;
  replaceWithResult: (removeIds: string[], result: NewSolid) => SolidObject | null;
  toggleVisibility: (id: string) => void;
  selectObject: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  setRightTab: (tab: RightTab) => void;
  setCreationMode: (mode: PrimitiveKind) => void;

  setClipEquation: (equation: string) => void;
  setClipEnabled: (enabled: boolean) => void;
  setClipKeepSide: (side: ClipKeepSide) => void;
  setShowClipHelper: (show: boolean) => void;

  setCsgA: (id: string | null) => void;
  setCsgB: (id: string | null) => void;
  setCsgOperation: (operation: BooleanOperation) => void;
  swapCsgPair: () => void;
  setOverlapPreview: (preview: OverlapPreview) => void;
  clearOverlapPreview: () => void;

  addProjection: (input: NewProjectionInput) => ProjectionLayer | null;
  removeProjection: (id: string) => void;
  toggleProjectionVisibility: (id: string) => void;
  clearProjections: () => void;
  setProjectionOpacity: (opacity: number) => void;

  requestCamera: (preset: CameraPreset) => void;
  requestFit: () => void;

  beginBusy: (busy: BusyState) => void;
  endBusy: () => void;
  pushToast: (
    toast: Omit<ToastMessage, 'id'> & { id?: string },
  ) => string;
  removeToast: (id: string) => void;

  clearScene: () => void;
  loadDemo: () => void;
}

function disposeGeometry(geometry: BufferGeometry | undefined): void {
  if (geometry) {
    geometry.dispose();
  }
}

function totalTriangleCount(objects: SolidObject[]): number {
  return objects.reduce((total, object) => total + object.triangleCount, 0);
}

function disposeOverlapPreview(preview: OverlapPreview | null): void {
  if (preview) {
    preview.geometry.dispose();
  }
}

function pickUnusedColor(objects: SolidObject[]): string {
  const used = new Set(objects.map((object) => object.color));
  return (
    OBJECT_PALETTE.find((color) => !used.has(color)) ??
    OBJECT_PALETTE[objects.length % OBJECT_PALETTE.length]
  );
}

function createNewSolid(state: StudioState, input: NewSolid): SolidObject {
  const names = state.objects.map((object) => object.name);
  const color = input.color ?? pickUnusedColor(state.objects);
  return {
    id: makeId('solid'),
    name: nextObjectName(names),
    label: input.label,
    kind: input.kind,
    color,
    geometry: input.geometry,
    triangleCount: input.triangleCount,
    vertexCount: input.vertexCount,
    visible: input.visible ?? true,
    createdAt: Date.now(),
    meta: input.meta ?? {},
  };
}

function pairAfterAdd(
  objects: SolidObject[],
  currentA: string | null,
  currentB: string | null,
  newId: string,
): { csgA: string | null; csgB: string | null } {
  let csgA = currentA && objects.some((object) => object.id === currentA) ? currentA : null;
  let csgB = currentB && objects.some((object) => object.id === currentB) ? currentB : null;

  if (!csgA) csgA = newId;
  if (!csgB && objects.length > 1) {
    csgB = objects.find((object) => object.id !== csgA)?.id ?? null;
  }
  if (csgA === csgB) {
    csgB = objects.find((object) => object.id !== csgA)?.id ?? null;
  }
  return { csgA, csgB };
}

const initialObjects = createDemoObjects();

export const useStudioStore = create<StudioState>((set, get) => ({
  objects: initialObjects,
  projections: [],
  selectedId: initialObjects[0]?.id ?? null,
  hoveredId: null,
  rightTab: 'boolean',
  creationMode: 'sphere',

  clipEquation: 'x + y + z = 3.5',
  clipEnabled: false,
  clipKeepSide: 'positive',
  showClipHelper: false,

  csgA: initialObjects[0]?.id ?? null,
  csgB: initialObjects[1]?.id ?? null,
  csgOperation: 'subtract',
  overlapPreview: null,

  projectionOpacity: 0.4,

  cameraPreset: 'iso',
  cameraSequence: 0,
  cameraFitSequence: 0,

  busy: null,
  toasts: [],

  addSolid: (input) => {
    const created = createNewSolid(get(), input);
    set((state) => {
      const objects = [...state.objects, created];
      const pair = pairAfterAdd(objects, state.csgA, state.csgB, created.id);
      return {
        objects,
        ...pair,
        selectedId: created.id,
      };
    });
    return created;
  },

  removeObject: (id) => {
    const state = get();
    const target = state.objects.find((object) => object.id === id);
    if (!target) return;

    const remaining = state.objects.filter((object) => object.id !== id);
    const removedProjections = state.projections.filter(
      (projection) => projection.sourceObjectId === id,
    );
    const projections = state.projections.filter(
      (projection) => projection.sourceObjectId !== id,
    );

    disposeGeometry(target.geometry);
    removedProjections.forEach((projection) => disposeGeometry(projection.geometry));

    const overlapPreview =
      state.overlapPreview &&
      (state.overlapPreview.aId === id || state.overlapPreview.bId === id)
        ? null
        : state.overlapPreview;
    if (overlapPreview !== state.overlapPreview) {
      disposeOverlapPreview(state.overlapPreview);
    }

    let csgA = state.csgA === id ? null : state.csgA;
    let csgB = state.csgB === id ? null : state.csgB;
    if (!csgA) csgA = remaining.find((object) => object.id !== csgB)?.id ?? null;
    if (!csgB) csgB = remaining.find((object) => object.id !== csgA)?.id ?? null;
    if (csgA === csgB) csgB = null;

    const selectedId =
      state.selectedId === id ? (remaining[0]?.id ?? null) : state.selectedId;

    set({ objects: remaining, projections, selectedId, csgA, csgB, overlapPreview });
  },

  replaceWithResult: (removeIds, result) => {
    const state = get();
    const removeSet = new Set(removeIds);
    const remaining = state.objects.filter((object) => !removeSet.has(object.id));
    const removed = state.objects.filter((object) => removeSet.has(object.id));
    const removedProjections = state.projections.filter((projection) =>
      removeSet.has(projection.sourceObjectId),
    );

    if (remaining.length === state.objects.length) return null;

    // Use the pre-operation name pool so a result never reuses A/B.
    const names = state.objects.map((object) => object.name);
    const color = result.color ?? pickUnusedColor(remaining);
    const created: SolidObject = {
      id: makeId('solid'),
      name: nextObjectName(names),
      label: result.label,
      kind: result.kind,
      color,
      geometry: result.geometry,
      triangleCount: result.triangleCount,
      vertexCount: result.vertexCount,
      visible: true,
      createdAt: Date.now(),
      meta: result.meta ?? {},
    };

    removed.forEach((object) => disposeGeometry(object.geometry));
    removedProjections.forEach((projection) => disposeGeometry(projection.geometry));
    disposeOverlapPreview(state.overlapPreview);

    const objects = [...remaining, created];
    const projections = state.projections.filter(
      (projection) => !removeSet.has(projection.sourceObjectId),
    );

    set({
      objects,
      projections,
      selectedId: created.id,
      csgA: created.id,
      csgB: objects.find((object) => object.id !== created.id)?.id ?? null,
      overlapPreview: null,
    });

    return created;
  },

  toggleVisibility: (id) => {
    set((state) => ({
      objects: state.objects.map((object) =>
        object.id === id ? { ...object, visible: !object.visible } : object,
      ),
    }));
  },

  selectObject: (id) => set({ selectedId: id }),
  setHovered: (id) => set({ hoveredId: id }),
  setRightTab: (tab) => set({ rightTab: tab }),
  setCreationMode: (mode) => set({ creationMode: mode }),

  setClipEquation: (equation) => set({ clipEquation: equation }),
  setClipEnabled: (enabled) => set({ clipEnabled: enabled }),
  setClipKeepSide: (side) => set({ clipKeepSide: side }),
  setShowClipHelper: (show) => set({ showClipHelper: show }),

  setCsgA: (id) => set({ csgA: id }),
  setCsgB: (id) => set({ csgB: id }),
  setCsgOperation: (operation) => set({ csgOperation: operation }),
  swapCsgPair: () => set((state) => ({ csgA: state.csgB, csgB: state.csgA })),
  setOverlapPreview: (preview) =>
    set((state) => {
      disposeOverlapPreview(state.overlapPreview);
      return { overlapPreview: preview };
    }),
  clearOverlapPreview: () =>
    set((state) => {
      disposeOverlapPreview(state.overlapPreview);
      return { overlapPreview: null };
    }),

  addProjection: (input) => {
    const state = get();
    const source = state.objects.find((object) => object.id === input.sourceObjectId);
    if (!source) return null;

    const existing = state.projections.filter(
      (projection) =>
        projection.sourceObjectId === input.sourceObjectId &&
        projection.plane === input.plane,
    );

    existing.forEach((projection) => disposeGeometry(projection.geometry));

    const layer: ProjectionLayer = {
      id: makeId('proj'),
      sourceObjectId: source.id,
      sourceName: source.name,
      sourceLabel: describeKind(source.kind, source.meta),
      plane: input.plane,
      color: PROJECTION_COLORS[input.plane],
      geometry: input.geometry,
      triangleCount: input.triangleCount,
      vertexCount: input.vertexCount,
      visible: true,
      createdAt: Date.now(),
    };

    set({
      projections: [
        ...state.projections.filter(
          (projection) =>
            !(
              projection.sourceObjectId === input.sourceObjectId &&
              projection.plane === input.plane
            ),
        ),
        layer,
      ],
    });
    return layer;
  },

  removeProjection: (id) => {
    const state = get();
    const target = state.projections.find((projection) => projection.id === id);
    if (!target) return;
    disposeGeometry(target.geometry);
    set({ projections: state.projections.filter((projection) => projection.id !== id) });
  },

  toggleProjectionVisibility: (id) => {
    set((state) => ({
      projections: state.projections.map((projection) =>
        projection.id === id ? { ...projection, visible: !projection.visible } : projection,
      ),
    }));
  },

  clearProjections: () => {
    const state = get();
    state.projections.forEach((projection) => disposeGeometry(projection.geometry));
    set({ projections: [] });
  },

  setProjectionOpacity: (opacity) =>
    set({ projectionOpacity: Math.min(1, Math.max(0.08, opacity)) }),

  requestCamera: (preset) =>
    set((state) => ({
      cameraPreset: preset,
      cameraSequence: state.cameraSequence + 1,
    })),

  requestFit: () =>
    set((state) => ({ cameraFitSequence: state.cameraFitSequence + 1 })),

  beginBusy: (busy) => set({ busy }),
  endBusy: () => set({ busy: null }),
  pushToast: (toast) => {
    const id = toast.id ?? makeId('toast');
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-3),
        {
          id,
          variant: toast.variant,
          title: toast.title,
          description: toast.description,
          duration: toast.duration ?? 5200,
        },
      ],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clearScene: () => {
    const state = get();
    state.objects.forEach((object) => disposeGeometry(object.geometry));
    state.projections.forEach((projection) => disposeGeometry(projection.geometry));
    disposeOverlapPreview(state.overlapPreview);
    set({
      objects: [],
      projections: [],
      selectedId: null,
      hoveredId: null,
      csgA: null,
      csgB: null,
      overlapPreview: null,
      clipEnabled: false,
      busy: null,
    });
  },

  loadDemo: () => {
    const state = get();
    state.objects.forEach((object) => disposeGeometry(object.geometry));
    state.projections.forEach((projection) => disposeGeometry(projection.geometry));
    disposeOverlapPreview(state.overlapPreview);
    const demoObjects = createDemoObjects();
    set({
      objects: demoObjects,
      projections: [],
      selectedId: demoObjects[0]?.id ?? null,
      hoveredId: null,
      csgA: demoObjects[0]?.id ?? null,
      csgB: demoObjects[1]?.id ?? null,
      overlapPreview: null,
      clipEnabled: false,
      busy: null,
    });
  },
}));

export function selectSelectedObject(state: StudioState): SolidObject | null {
  return state.objects.find((object) => object.id === state.selectedId) ?? null;
}

export function selectTotalTriangles(state: StudioState): number {
  return totalTriangleCount(state.objects);
}
