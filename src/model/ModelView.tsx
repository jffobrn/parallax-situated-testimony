import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { type ModelAnchor, type SceneModel, type Viewpoint } from '../core'
import { useStore } from '../state/store'
import { useMediaUrl } from '../state/useMediaUrl'
import { activeStatementId, modelAnchors, statementSnippet } from '../lib/derive'
import { viewpointBridge } from './viewpointBridge'
import { token, useTheme, type Theme } from '../state/theme'
import { MAP_TOOLS_SLOT, ToolIcon } from '../panels/Toolbar'

/** Scene colours, read from the design tokens so the model follows the theme. */
interface SceneColours {
  ground: string
  sea: string
  massing: string
  edge: string
  gridMajor: string
  gridMinor: string
  sky: string
  under: string
  anchor: string
  hover: string
  focus: string
}

function readScene(theme: Theme): SceneColours {
  const dark = theme === 'dark'
  return {
    ground: token(dark ? '--field' : '--field-2'),
    sea: token(dark ? '--input' : '--line-strong'),
    massing: token(dark ? '--line-strong' : '--surface'),
    edge: token('--text-3'),
    gridMajor: token('--line-strong'),
    gridMinor: token('--line-2'),
    sky: dark ? '#e6e2da' : '#f3f2ee',
    under: token('--line-strong'),
    anchor: token('--primary'),
    hover: token('--signal-dim'),
    focus: token('--mark'),
  }
}

function useSceneColours(): SceneColours {
  const theme = useTheme()
  return useMemo(() => readScene(theme), [theme])
}

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
  const C = useSceneColours()
  const [toolSlot, setToolSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setToolSlot(document.getElementById(MAP_TOOLS_SLOT)), [])

  return (
    <>
      <Canvas
        camera={{ position: [16, 13, 20], fov: 45, near: 0.1, far: 2000 }}
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0, background: 'var(--map-ground)' }}
      >
        <hemisphereLight key={`h-${C.sky}-${C.under}`} args={[C.sky, C.under, 0.8]} />
        <directionalLight position={[14, 22, 10]} intensity={1.2} />
        <ambientLight intensity={0.45} />
        <gridHelper key={`g-${C.gridMajor}-${C.gridMinor}`} args={[80, 40, C.gridMajor, C.gridMinor]} position={[0, 0, 0]} />

        <Suspense fallback={null}>
          <Scene model={model} placing={placingHere} colours={C} />
        </Suspense>

        <Anchors colours={C} />
        <CameraRig />
        <ViewpointBridge />

        <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2.02} />
      </Canvas>

      {toolSlot && createPortal(<ViewpointTool />, toolSlot)}
      <div className="stage-readout">{model?.title ?? 'Procedural massing'}</div>
      {placingHere && (
        <div className="map-banner">
          <span>Click the model to anchor the statement</span>
          <button className="btn btn-sm btn-ghost" onClick={() => useStore.getState().setPlacing(null)}>
            Cancel
          </button>
        </div>
      )}
      <div className="model-legend" aria-label="Model key">
        <div className="legend-row"><span className="sw sw-anchor" /> Statement anchor</div>
        <div className="legend-row"><span className="sw sw-sel" /> In focus</div>
        <div className="legend-row faint">Drag to orbit, scroll to zoom</div>
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

/**
 * Save the live camera as the selected statement's viewpoint, from the tool bar.
 * The same capture as the statement editor's button.
 */
function ViewpointTool() {
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const statement = useStore((s) => s.project.statements.find((x) => x.id === s.selectedStatementId))
  const capture = () => {
    if (!selectedStatementId) return
    const vp = viewpointBridge.capture()
    if (!vp) return
    useStore.getState().updateStatement(selectedStatementId, { viewpoint: vp })
    useStore.getState().notify('Viewpoint saved.')
  }
  return (
    <button
      className="tool"
      disabled={!statement}
      onClick={capture}
      title={statement ? 'Save this camera as the selected statement\'s viewpoint' : 'Select a statement first'}
    >
      <ToolIcon name="camera" />
      {statement?.viewpoint ? 'Recapture viewpoint' : 'Capture viewpoint'}
    </button>
  )
}

function Scene({
  model,
  placing,
  colours,
}: {
  model: SceneModel | undefined
  placing: boolean
  colours: SceneColours
}) {
  if (model?.kind === 'gltf' && model.file?.blobKey) {
    return <GltfScene blobKey={model.file.blobKey} placing={placing} />
  }
  if (model?.kind === 'gltf' && model.url) {
    return <GltfModel url={model.url} placing={placing} />
  }
  return <ProceduralScene placing={placing} colours={colours} />
}

/**
 * A neutral massing of the waterfront the sample is situated in: a ground plane,
 * a long sea wall, and a building behind it. Plainly schematic, not a survey.
 */
function ProceduralScene({ placing, colours: C }: { placing: boolean; colours: SceneColours }) {
  const onDown = (e: ThreeEvent<PointerEvent>) => placeFromEvent(e, placing)
  return (
    <group onPointerDown={onDown}>
      {/* ground / quay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color={C.ground} roughness={1} />
      </mesh>

      {/* sea (a darker strip on the south side) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 12]}>
        <planeGeometry args={[60, 16]} />
        <meshStandardMaterial color={C.sea} roughness={1} />
      </mesh>

      {/* the sea wall: a long low wall the mural was painted on */}
      <Massing colours={C} args={[26, 2.4, 0.8]} position={[0, 1.2, 4]} />

      {/* a building block set back from the wall */}
      <Massing colours={C} args={[9, 7, 7]} position={[-7, 3.5, -6]} />
      {/* a lower annex */}
      <Massing colours={C} args={[6, 4, 5]} position={[6, 2, -5]} />
      {/* a stair / plinth by the wall */}
      <Massing colours={C} args={[3, 1, 2]} position={[10, 0.5, 3]} />
    </group>
  )
}

function Massing({
  args,
  position,
  colours: C,
}: {
  args: [number, number, number]
  position: [number, number, number]
  colours: SceneColours
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={C.massing} roughness={0.9} metalness={0} />
      <Edges threshold={15} color={C.edge} />
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

function Anchors({ colours }: { colours: SceneColours }) {
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
            colours={colours}
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
  colours: C,
  onSelect,
  onHover,
}: {
  point: ModelAnchor
  emphasized: boolean
  hovered: boolean
  label: string
  colours: SceneColours
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const color = emphasized ? C.focus : hovered ? C.hover : C.anchor
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

/**
 * Registers a capture of the live camera pose for the statement editor to save.
 */
function ViewpointBridge() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  useEffect(() => {
    viewpointBridge.capture = () => {
      const c = controls as unknown as { target?: THREE.Vector3 } | null
      if (!c?.target) return null
      const p = camera.position
      const t = c.target
      return { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
    }
    return () => {
      viewpointBridge.capture = () => null
    }
  }, [camera, controls])
  return null
}

/**
 * Leads the camera to the focused statement. When the statement has a saved
 * viewpoint, the camera flies there (position and target) once on selection, then
 * releases so the user can orbit freely. Without a viewpoint, only the orbit
 * target is led to the anchor, the earlier behaviour, leaving the orbit to hand.
 */
function CameraRig() {
  const desiredTarget = useRef(new THREE.Vector3())
  const desiredPos = useRef(new THREE.Vector3())
  const lastFocus = useRef<string | null | undefined>(undefined)
  const flying = useRef<Viewpoint | null>(null)

  useFrame((state) => {
    const st = useStore.getState()
    const focusId = st.selectedStatementId ?? activeStatementId(st.project, st.playheadSec)
    const stmt = focusId ? st.project.statements.find((s) => s.id === focusId) : undefined
    const controls = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null
    if (!controls?.target) return

    // A change of focus begins a flight to that statement's saved viewpoint.
    if (focusId !== lastFocus.current) {
      lastFocus.current = focusId
      flying.current = stmt?.viewpoint ?? null
    }

    if (flying.current) {
      const vp = flying.current
      desiredPos.current.set(vp.pos[0], vp.pos[1], vp.pos[2])
      desiredTarget.current.set(vp.target[0], vp.target[1], vp.target[2])
      state.camera.position.lerp(desiredPos.current, 0.08)
      controls.target.lerp(desiredTarget.current, 0.08)
      controls.update()
      if (state.camera.position.distanceTo(desiredPos.current) < 0.08) flying.current = null
      return
    }

    // No saved viewpoint: lead the orbit target to the anchor, leaving orbit free.
    if (!stmt?.viewpoint) {
      const focus = stmt?.anchor?.model
      if (!focus) return
      desiredTarget.current.set(focus.x, focus.y, focus.z)
      controls.target.lerp(desiredTarget.current, 0.06)
      controls.update()
    }
  })

  return null
}
