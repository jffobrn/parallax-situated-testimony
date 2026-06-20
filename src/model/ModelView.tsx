import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { type ModelAnchor, type SceneModel } from '../core'
import { useStore } from '../state/store'
import { useMediaUrl } from '../state/useMediaUrl'
import { activeStatementId, modelAnchors, statementSnippet } from '../lib/derive'

const NEUTRAL = '#273140'
const EDGE = '#5b6a80'
const SIGNAL = '#f3a93c'
const SIGNAL_BRIGHT = '#ffc163'
const MARK = '#b8c2d0'

/**
 * The model view: the scene the testimony is situated in (a loaded glTF, or a
 * neutral procedural massing when none is set), with each statement's anchor as a
 * marker. Click a marker to select its statement; selecting a statement orbits
 * the camera to its anchor. In placement mode, clicking the scene drops the
 * anchor. The 3D counterpart of crossing sightlines: memory fixed in space.
 */
export function ModelView() {
  const model = useStore((s) => s.project.testimony.model)
  const placing = useStore((s) => s.placing)
  const placingHere = placing?.kind === 'statement-model'

  return (
    <>
      <Canvas
        camera={{ position: [16, 13, 20], fov: 45, near: 0.1, far: 2000 }}
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0, background: '#07090c' }}
      >
        <hemisphereLight args={['#cdd6e2', '#0a0d12', 0.8]} />
        <directionalLight position={[14, 22, 10]} intensity={1.4} />
        <ambientLight intensity={0.45} />
        <gridHelper args={[80, 40, '#5b6a80', '#1d2430']} position={[0, 0, 0]} />

        <Suspense fallback={null}>
          <Scene model={model} placing={placingHere} />
        </Suspense>

        <Anchors />
        <CameraRig />

        <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2.02} />
      </Canvas>

      <div className="stage-readout">{model?.title ?? 'Procedural massing'}</div>
      {placingHere && (
        <div className="map-banner">
          <span>Click the model to anchor the statement</span>
          <button className="btn btn-sm btn-ghost" onClick={() => useStore.getState().setPlacing(null)}>
            Cancel
          </button>
        </div>
      )}
      <div className="model-legend mono">
        <div className="legend-row"><span className="sw sw-cross" /> anchor</div>
        <div className="legend-row"><span className="sw" style={{ background: MARK }} /> statement</div>
        <div className="legend-row faint">drag to orbit, scroll to zoom</div>
      </div>
    </>
  )
}

/** Apply a placement click on any scene surface. */
function placeFromEvent(e: ThreeEvent<PointerEvent>, placing: boolean) {
  if (!placing) return
  e.stopPropagation()
  useStore.getState().applyModelPlacement({ x: e.point.x, y: e.point.y, z: e.point.z })
}

function Scene({ model, placing }: { model: SceneModel | undefined; placing: boolean }) {
  if (model?.file?.blobKey && model.kind === 'gltf') {
    return <GltfScene blobKey={model.file.blobKey} placing={placing} />
  }
  return <ProceduralScene placing={placing} />
}

/**
 * A neutral massing of the waterfront the sample is situated in: a ground plane,
 * a long sea wall, and a building behind it. Plainly schematic, not a survey.
 */
function ProceduralScene({ placing }: { placing: boolean }) {
  const onDown = (e: ThreeEvent<PointerEvent>) => placeFromEvent(e, placing)
  return (
    <group onPointerDown={onDown}>
      {/* ground / quay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#11161e" roughness={1} />
      </mesh>

      {/* sea (a darker strip on the south side) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 12]}>
        <planeGeometry args={[60, 16]} />
        <meshStandardMaterial color="#0b1118" roughness={1} />
      </mesh>

      {/* the sea wall: a long low wall the mural was painted on */}
      <Massing args={[26, 2.4, 0.8]} position={[0, 1.2, 4]} />

      {/* a building block set back from the wall */}
      <Massing args={[9, 7, 7]} position={[-7, 3.5, -6]} />
      {/* a lower annex */}
      <Massing args={[6, 4, 5]} position={[6, 2, -5]} />
      {/* a stair / plinth by the wall */}
      <Massing args={[3, 1, 2]} position={[10, 0.5, 3]} />
    </group>
  )
}

function Massing({
  args,
  position,
}: {
  args: [number, number, number]
  position: [number, number, number]
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={NEUTRAL} roughness={0.9} metalness={0} />
      <Edges threshold={15} color={EDGE} />
    </mesh>
  )
}

function GltfScene({ blobKey, placing }: { blobKey: string; placing: boolean }) {
  const url = useMediaUrl(blobKey)
  if (!url) return null
  return <GltfModel url={url} placing={placing} />
}

function GltfModel({ url, placing }: { url: string; placing: boolean }) {
  const gltf = useGLTF(url)
  // Each loaded model gets a fresh blob URL, so drei's GLTF cache would grow and
  // retain parsed scenes (and their GPU resources) keyed by now-dead URLs. Clear
  // the cache entry for this URL when it is replaced or unmounted.
  useEffect(() => {
    return () => {
      try {
        useGLTF.clear(url)
      } catch {
        // best effort; nothing to do if the cache entry is already gone.
      }
    }
  }, [url])
  const onDown = (e: ThreeEvent<PointerEvent>) => placeFromEvent(e, placing)
  return <primitive object={gltf.scene} onPointerDown={onDown} />
}

function Anchors() {
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const hoveredId = useStore((s) => s.hoveredId)
  const playheadSec = useStore((s) => s.playheadSec)
  const activeId = activeStatementId(project, playheadSec)

  const marks = useMemo(() => modelAnchors(project), [project])
  const snippetById = useMemo(() => {
    const m = new Map<string, string>()
    for (const st of project.statements) m.set(st.id, statementSnippet(st, 48))
    return m
  }, [project])

  return (
    <>
      {marks.map((mk) => {
        const emph = mk.statementId === selectedStatementId || mk.statementId === activeId
        const hov = mk.statementId === hoveredId
        return (
          <AnchorMarker
            key={mk.statementId}
            point={mk.point}
            emphasized={emph}
            hovered={hov}
            label={snippetById.get(mk.statementId) ?? ''}
            onSelect={() => useStore.getState().selectStatement(mk.statementId)}
            onHover={(on) => useStore.getState().hover(on ? mk.statementId : null)}
          />
        )
      })}
    </>
  )
}

function AnchorMarker({
  point,
  emphasized,
  hovered,
  label,
  onSelect,
  onHover,
}: {
  point: ModelAnchor
  emphasized: boolean
  hovered: boolean
  label: string
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const color = emphasized ? SIGNAL_BRIGHT : hovered ? SIGNAL : MARK
  const r = emphasized ? 0.5 : 0.38
  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(true)
        }}
        onPointerOut={() => onHover(false)}
      >
        <sphereGeometry args={[r, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emphasized ? 0.7 : 0.25} />
      </mesh>
      {/* a vertical stem so the anchor reads against the massing */}
      <mesh position={[0, -point.y / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, point.y, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {(emphasized || hovered) && label && (
        <Html center distanceFactor={28} position={[0, r + 0.7, 0]}>
          <div className="model-anchor-label" dir="auto">{label}</div>
        </Html>
      )}
    </group>
  )
}

/** Lerp the orbit target toward the focused statement's anchor. */
function CameraRig() {
  const desired = useRef(new THREE.Vector3())

  // Read the focus inside the frame loop (not during render) so this stays pure
  // under StrictMode and concurrent rendering. The selected statement, or the
  // active one under the playhead, leads the camera.
  useFrame((state) => {
    const st = useStore.getState()
    const focusId = st.selectedStatementId ?? activeStatementId(st.project, st.playheadSec)
    const focus = focusId
      ? st.project.statements.find((s) => s.id === focusId)?.anchor?.model
      : undefined
    if (!focus) return
    const controls = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null
    if (!controls?.target) return
    desired.current.set(focus.x, focus.y, focus.z)
    controls.target.lerp(desired.current, 0.06)
    controls.update()
  })

  return null
}
