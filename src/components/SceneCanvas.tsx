import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  Line,
  OrbitControls,
  useCursor,
} from '@react-three/drei';
import * as THREE from 'three';
import { useClipPlane } from '../hooks/useClipPlane';
import { registerSnapshotRenderer } from '../lib/snapshot';
import { describeKind, formatCount } from '../lib/utils';
import { useStudioStore } from '../store/useStudioStore';
import type {
  CameraPreset,
  OverlapPreview,
  ProjectionLayer,
  SolidObject,
} from '../types';

const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: [number, number, number]; up: [number, number, number]; target: [number, number, number] }
> = {
  iso: { position: [10.6, -13.1, 10.8], up: [0, 0, 1], target: [0, 0, 1.4] },
  front: { position: [0, -17, 3.4], up: [0, 0, 1], target: [0, 0, 1.4] },
  side: { position: [17, 0, 3.4], up: [0, 0, 1], target: [0, 0, 1.4] },
  top: { position: [0, 0.001, 17.5], up: [0, 1, 0], target: [0, 0, 0.9] },
};

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const cameraPreset = useStudioStore((state) => state.cameraPreset);
  const cameraSequence = useStudioStore((state) => state.cameraSequence);
  const cameraFitSequence = useStudioStore((state) => state.cameraFitSequence);

  useEffect(() => {
    if (!controls) return;
    const preset = CAMERA_PRESETS[cameraPreset];
    camera.position.set(...preset.position);
    camera.up.set(...preset.up);
    controls.target.set(...preset.target);
    camera.lookAt(controls.target);
    controls.update();
    // cameraSequence is intentionally included to re-trigger the same preset.
  }, [camera, controls, cameraPreset, cameraSequence]);

  useEffect(() => {
    if (!controls || cameraFitSequence === 0) return;
    const objects = useStudioStore.getState().objects.filter((object) => object.visible);
    if (objects.length === 0) return;

    const union = new THREE.Box3();
    const objectBox = new THREE.Box3();
    for (const object of objects) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox;
      if (!box) continue;
      objectBox.copy(box);
      union.union(objectBox);
    }
    if (union.isEmpty()) return;

    const sphere = union.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center.clone();
    const radius = Math.max(sphere.radius, 0.75);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov ?? 38);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (perspectiveCamera.aspect ?? 1));
    const limitingFov = Math.max(0.15, Math.min(verticalFov, horizontalFov));
    const distance = (radius / Math.sin(limitingFov / 2)) * 1.25;
    const direction = new THREE.Vector3(1, -1.22, 0.9).normalize();

    camera.position.copy(center).addScaledVector(direction, distance);
    camera.up.set(0, 0, 1);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  }, [camera, controls, cameraFitSequence]);

  return null;
}

function SnapshotBridge() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(
    () =>
      registerSnapshotRenderer(() => {
        gl.render(scene, camera);
        const source = gl.domElement;
        const output = document.createElement('canvas');
        output.width = source.width;
        output.height = source.height;
        const context = output.getContext('2d');
        if (!context) return null;

        const background = context.createRadialGradient(
          output.width * 0.5,
          output.height * 0.34,
          0,
          output.width * 0.5,
          output.height * 0.34,
          output.width * 0.78,
        );
        background.addColorStop(0, '#111d25');
        background.addColorStop(0.62, '#0a1117');
        background.addColorStop(1, '#070c10');
        context.fillStyle = background;
        context.fillRect(0, 0, output.width, output.height);
        context.drawImage(source, 0, 0);

        const scale = Math.max(1, output.height / 1000);
        const margin = 28 * scale;
        const markSize = Math.max(1, 1.1 * scale);
        context.fillStyle = 'rgba(141, 230, 194, 0.82)';
        context.beginPath();
        context.arc(margin, output.height - margin - 1.5 * scale, 2.6 * scale, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = 'rgba(220, 243, 235, 0.7)';
        context.font = `600 ${Math.round(13 * markSize)}px "Segoe UI", "Microsoft YaHei", sans-serif`;
        context.fillText('剖物 · GEOMETRY LAB', margin + 9 * markSize, output.height - margin);

        context.fillStyle = 'rgba(140, 160, 172, 0.42)';
        context.font = `${Math.round(9 * markSize)}px "Cascadia Code", Consolas, monospace`;
        context.textAlign = 'right';
        context.fillText('SOLID GEOMETRY / WEBGL', output.width - margin, output.height - margin);
        return output.toDataURL('image/png');
      }),
    [gl, scene, camera],
  );

  return null;
}

function AxisGizmo() {
  const axes: Array<{
    key: 'x' | 'y' | 'z';
    color: string;
    end: [number, number, number];
    negative: [number, number, number];
    arrowRotation: [number, number, number];
    label: string;
  }> = [
    { key: 'x', color: '#ff7e76', end: [4.9, 0, 0], negative: [-2.2, 0, 0], arrowRotation: [0, 0, -Math.PI / 2], label: 'X' },
    { key: 'y', color: '#74e6a6', end: [0, 4.9, 0], negative: [0, -2.2, 0], arrowRotation: [0, 0, 0], label: 'Y' },
    { key: 'z', color: '#74baff', end: [0, 0, 4.9], negative: [0, 0, -2.2], arrowRotation: [Math.PI / 2, 0, 0], label: 'Z' },
  ];

  return (
    <group>
      {axes.map((axis) => (
        <group key={axis.key}>
          <Line
            points={[axis.negative, [0.02, 0.02, 0.02]]}
            color={axis.color}
            lineWidth={0.8}
            transparent
            opacity={0.2}
          />
          <Line
            points={[
              [-0.05, -0.05, -0.05],
              axis.end,
            ]}
            color={axis.color}
            lineWidth={1.25}
            transparent
            opacity={0.85}
          />
          <mesh position={axis.end} rotation={axis.arrowRotation} raycast={() => null}>
            <coneGeometry args={[0.07, 0.22, 12]} />
            <meshBasicMaterial color={axis.color} toneMapped={false} />
          </mesh>
          <Html
            position={[
              axis.key === 'x' ? 5.35 : 0,
              axis.key === 'y' ? 5.35 : 0,
              axis.key === 'z' ? 5.35 : 0,
            ]}
            center
            zIndexRange={[12, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <span className={`axis-tag axis-tag-${axis.key}`}>{axis.label}</span>
          </Html>
        </group>
      ))}
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color="#d8e7ef" toneMapped={false} />
      </mesh>
      <Html
        position={[-0.28, -0.28, 0.18]}
        center
        zIndexRange={[12, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <span className="axis-origin">O</span>
      </Html>
    </group>
  );
}

function GroundShadowCatcher() {
  return (
    <mesh position={[0, 0, -0.018]} rotation={[0, 0, 0]} receiveShadow raycast={() => null}>
      <planeGeometry args={[36, 36]} />
      <shadowMaterial transparent opacity={0.34} color="#000000" />
    </mesh>
  );
}

function SelectionCage({ geometry, color }: { geometry: THREE.BufferGeometry; color: string }) {
  const points = useMemo(() => {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox?.clone().expandByScalar(0.055);
    if (!box) return [];

    const { min, max } = box;
    const corners: THREE.Vector3[] = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    return edges.flatMap(([a, b]) => [
      corners[a].toArray() as [number, number, number],
      corners[b].toArray() as [number, number, number],
    ]);
  }, [geometry]);

  if (points.length === 0) return null;
  return (
    <Line
      points={points}
      segments
      color={color}
      lineWidth={1}
      transparent
      opacity={0.58}
    />
  );
}

function SolidObjectView({
  object,
  selected,
  clippingPlanes,
  ghosted = false,
}: {
  object: SolidObject;
  selected: boolean;
  clippingPlanes: THREE.Plane[];
  ghosted?: boolean;
}) {
  const hovered = useStudioStore((state) => state.hoveredId === object.id);
  const selectObject = useStudioStore((state) => state.selectObject);
  const setHovered = useStudioStore((state) => state.setHovered);

  useCursor(hovered);

  const labelPosition = useMemo(() => {
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (!box) return [0, 0, 0] as [number, number, number];
    const center = box.getCenter(new THREE.Vector3());
    return [center.x, center.y, box.max.z + 0.32] as [number, number, number];
  }, [object.geometry]);

  return (
    <group>
      <mesh
        geometry={object.geometry}
        visible={object.visible}
        castShadow={!ghosted}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          selectObject(object.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(object.id);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          if (useStudioStore.getState().hoveredId === object.id) setHovered(null);
        }}
      >
        <meshPhysicalMaterial
          color={object.color}
          emissive={object.color}
          emissiveIntensity={selected ? 0.11 : hovered ? 0.045 : 0}
          roughness={0.34}
          metalness={0.06}
          clearcoat={0.6}
          clearcoatRoughness={0.32}
          reflectivity={0.4}
          clippingPlanes={clippingPlanes}
          clipShadows
          transparent={ghosted}
          opacity={ghosted ? 0.13 : 1}
          depthWrite={!ghosted}
          side={ghosted ? THREE.DoubleSide : THREE.FrontSide}
        />
      </mesh>

      {selected && object.visible ? (
        <SelectionCage geometry={object.geometry} color={object.color} />
      ) : null}

      {object.visible ? (
        <Html
          position={labelPosition}
          center
          zIndexRange={[24, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <span className={`scene-label ${selected ? 'is-selected' : ''}`}>
            <span className="scene-label-dot" style={{ backgroundColor: object.color }} />
            <span className="scene-label-name">{object.name}</span>
            <span className="scene-label-kind">{describeKind(object.kind, object.meta)}</span>
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function OverlapPreviewView({
  preview,
  clippingPlanes,
}: {
  preview: OverlapPreview;
  clippingPlanes: THREE.Plane[];
}) {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const labelPosition = useMemo(() => {
    if (!preview.geometry.boundingBox) preview.geometry.computeBoundingBox();
    const box = preview.geometry.boundingBox;
    if (!box) return [0, 0, 0] as [number, number, number];
    const center = box.getCenter(new THREE.Vector3());
    return [center.x, center.y, center.z] as [number, number, number];
  }, [preview.geometry]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.34 + Math.sin(clock.elapsedTime * 2.2) * 0.1;
    }
  });

  return (
    <group>
      <mesh
        geometry={preview.geometry}
        renderOrder={4}
        castShadow={false}
        receiveShadow={false}
        raycast={() => null}
      >
        <meshPhysicalMaterial
          ref={materialRef}
          color="#ffd166"
          emissive="#ff9f2f"
          emissiveIntensity={0.38}
          roughness={0.27}
          metalness={0.16}
          clearcoat={0.35}
          clearcoatRoughness={0.35}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      <Html
        position={labelPosition}
        center
        zIndexRange={[26, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <span className="overlap-tag">
          <span className="overlap-tag-dot" />A ∩ B · 重叠区
          <span className="overlap-tag-faces">{formatCount(preview.triangleCount)} 面</span>
        </span>
      </Html>
    </group>
  );
}

function ClipPlaneHelper({ plane }: { plane: THREE.Plane }) {
  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        plane.normal.clone().normalize(),
      ),
    [plane.normal.x, plane.normal.y, plane.normal.z],
  );
  const point = useMemo(
    () => plane.normal.clone().multiplyScalar(-plane.constant),
    [plane.normal.x, plane.normal.y, plane.normal.z, plane.constant],
  );
  const half = 8;
  const border = [
    [-half, -half, 0],
    [half, -half, 0],
    [half, half, 0],
    [-half, half, 0],
    [-half, -half, 0],
  ] as [number, number, number][];

  return (
    <group position={point} quaternion={quaternion}>
      <mesh raycast={() => null}>
        <planeGeometry args={[half * 2, half * 2]} />
        <meshBasicMaterial
          color="#8de6c2"
          transparent
          opacity={0.038}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Line points={border} color="#8de6c2" lineWidth={1.1} transparent opacity={0.56} />
      <Line
        points={[
          [-half, 0, 0.002],
          [half, 0, 0.002],
        ]}
        color="#8de6c2"
        lineWidth={0.8}
        transparent
        opacity={0.14}
      />
      <Line
        points={[
          [0, -half, 0.002],
          [0, half, 0.002],
        ]}
        color="#8de6c2"
        lineWidth={0.8}
        transparent
        opacity={0.14}
      />
      <Line
        points={[
          [0, 0, 0],
          [0, 0, 1.05],
        ]}
        color="#c8ffe9"
        lineWidth={1.4}
        transparent
        opacity={0.92}
      />
      <mesh position={[0, 0, 1.15]} raycast={() => null}>
        <coneGeometry args={[0.065, 0.16, 14]} />
        <meshBasicMaterial color="#c8ffe9" toneMapped={false} />
      </mesh>
    </group>
  );
}

function ProjectionLayerView({
  layer,
  clippingPlanes,
}: {
  layer: ProjectionLayer;
  clippingPlanes: THREE.Plane[];
}) {
  const opacity = useStudioStore((state) => state.projectionOpacity);

  const { offset, framePoints } = useMemo(() => {
    const half = 5.6;
    if (layer.plane === 'XOY') {
      return {
        offset: [0, 0, 0.012] as [number, number, number],
        framePoints: [
          [-half, -half, 0],
          [half, -half, 0],
          [half, half, 0],
          [-half, half, 0],
          [-half, -half, 0],
        ] as [number, number, number][],
      };
    }
    if (layer.plane === 'YOZ') {
      return {
        offset: [0.012, 0, 0] as [number, number, number],
        framePoints: [
          [0, -half, -half],
          [0, half, -half],
          [0, half, half],
          [0, -half, half],
          [0, -half, -half],
        ] as [number, number, number][],
      };
    }
    return {
      offset: [0, 0.012, 0] as [number, number, number],
      framePoints: [
        [-half, 0, -half],
        [half, 0, -half],
        [half, 0, half],
        [-half, 0, half],
        [-half, 0, -half],
      ] as [number, number, number][],
    };
  }, [layer.plane]);

  if (!layer.visible) return null;

  return (
    <group position={offset}>
      <mesh geometry={layer.geometry} renderOrder={6}>
        <meshBasicMaterial
          color={layer.color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
          clippingPlanes={clippingPlanes}
          toneMapped={false}
        />
      </mesh>
      <Line
        points={framePoints}
        color={layer.color}
        lineWidth={0.8}
        transparent
        opacity={0.2}
        dashed
        dashSize={0.18}
        gapSize={0.13}
      />
    </group>
  );
}

function SceneContent() {
  const objects = useStudioStore((state) => state.objects);
  const projections = useStudioStore((state) => state.projections);
  const selectedId = useStudioStore((state) => state.selectedId);
  const clipEnabled = useStudioStore((state) => state.clipEnabled);
  const showClipHelper = useStudioStore((state) => state.showClipHelper);
  const overlapPreview = useStudioStore((state) => state.overlapPreview);
  const selectObject = useStudioStore((state) => state.selectObject);
  const clip = useClipPlane();

  const clippingPlanes = useMemo(
    () => (clipEnabled && clip.plane ? [clip.plane] : []),
    [clipEnabled, clip.plane],
  );

  return (
    <>
      <fog attach="fog" args={['#0a1117', 30, 68]} />
      <ambientLight intensity={0.52} color="#dbeaff" />
      <hemisphereLight args={['#c8e1ff', '#18212a', 1.15]} />
      <directionalLight
        position={[6, -8, 14]}
        intensity={2.6}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={18}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-9, 6, 5]} intensity={0.8} color="#5c9dff" />
      <pointLight position={[7, 8, 7]} intensity={28} distance={32} color="#ffb36b" />

      <GroundShadowCatcher />
      <Grid
        args={[26, 26]}
        rotation={[Math.PI / 2, 0, 0]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#23333f"
        sectionSize={2}
        sectionThickness={0.85}
        sectionColor="#3b5667"
        fadeDistance={38}
        fadeStrength={1.2}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />

      <AxisGizmo />

      {objects.map((object) => (
        <SolidObjectView
          key={object.id}
          object={object}
          selected={object.id === selectedId}
          clippingPlanes={clippingPlanes}
          ghosted={
            Boolean(overlapPreview) &&
            (overlapPreview?.aId === object.id || overlapPreview?.bId === object.id)
          }
        />
      ))}

      {overlapPreview ? (
        <OverlapPreviewView
          preview={overlapPreview}
          clippingPlanes={clippingPlanes}
        />
      ) : null}

      {projections.map((layer) => (
        <ProjectionLayerView key={layer.id} layer={layer} clippingPlanes={clippingPlanes} />
      ))}

      {showClipHelper && clip.plane ? (
        <ClipPlaneHelper plane={clip.plane} />
      ) : null}

      <SnapshotBridge />
      <CameraRig />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.72}
        zoomSpeed={0.85}
        panSpeed={0.75}
        screenSpacePanning
        minDistance={2}
        maxDistance={48}
      />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport
          axisColors={['#ff8279', '#7ce4a9', '#7cbcff']}
          labelColor="#081016"
          hideNegativeAxes
        />
      </GizmoHelper>

    </>
  );
}

export function SceneCanvas() {
  const selectObject = useStudioStore((state) => state.selectObject);

  return (
    <Canvas
      className="r3f-canvas"
      shadows
      dpr={[1, 1.75]}
      camera={{
        position: [9.6, -11.8, 10],
        fov: 38,
        near: 0.1,
        far: 200,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl, camera }) => {
        gl.localClippingEnabled = true;
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 1.35);
      }}
      onPointerMissed={() => selectObject(null)}
    >
      <SceneContent />
    </Canvas>
  );
}
