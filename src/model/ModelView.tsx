import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, Html, Line, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { type ModelAnchor, type SceneModel, type Viewpoint } from '../core'
import { useStore } from '../state/store'
import { useMediaUrl } from '../state/useMediaUrl'
import { activeStatementId, modelAnchors, statementSnippet } from '../lib/derive'
import { viewpointBridge } from './viewpointBridge'
import { token, useTheme, type Theme } from '../state/theme'
import { MAP_TOOLS_SLOT, ToolIcon } from '../panels/Toolbar'
import { allCameras, effectiveGeoref } from '../lib/cameras'
import { bearingToModelDir, geoToModel, metresToUnits, type ModelGeoref, type RefCamera } from '../core'

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
  camera: string
  withheld: string
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
    camera: token('--text-2'),
    withheld: token('--alert'),
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
  const placingHere = placing?.kind === 'statement-model' || placing?.kind === 'georef-model'
  const lookThroughId = useStore((s) => s.lookThroughId)
  const testimony = useStore((s) => s.project.testimony)
  const looking = lookThroughId ? allCameras(testimony).find((c) => c.camera.id === lookThroughId) : undefined
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

        <ModelErrorBoundary
          resetKey={`${model?.file?.blobKey ?? ''}|${model?.url ?? ''}`}
          fallback={<ProceduralScene placing={placingHere} colours={C} />}
        >
          <Suspense fallback={null}>
            <Scene model={model} placing={placingHere} colours={C} />
          </Suspense>
        </ModelErrorBoundary>

        <Anchors colours={C} />
        <Cameras colours={C} />
        <CameraRig />
        <ViewpointBridge />

        <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2.02} />
      </Canvas>

      {toolSlot && createPortal(<ViewpointTool />, toolSlot)}
      <div className="stage-readout">{model?.title ?? 'Procedural massing'}</div>
      {placingHere && (
        <div className="map-banner">
          <span>
            {placing?.kind === 'georef-model'
              ? `Georeference: click point ${placing.point.toUpperCase()} on the model, then the same point on the map`
              : 'Click the model to anchor the statement'}
          </span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              placing?.kind === 'georef-model'
                ? useStore.getState().cancelGeorefMatch()
                : useStore.getState().setPlacing(null)
            }
          >
            Cancel
          </button>
        </div>
      )}
      {looking && looking.camera.photo && <PhotoOverlay blobKey={looking.camera.photo.blobKey} />}
      {looking && !placingHere && (
        <div className="map-banner">
          <span title={`From ${looking.set.title}`}>
            Looking through <b>{looking.camera.label}</b>
          </span>
          <button className="btn btn-sm btn-ghost" onClick={() => useStore.getState().setLookThrough(null)}>
            Return to orbit
          </button>
        </div>
      )}
      <div className="model-legend" aria-label="Model key">
        <div className="legend-row"><span className="sw sw-anchor" /> Statement anchor</div>
        <div className="legend-row"><span className="sw sw-sel" /> In focus</div>
        {(testimony.cameraSets?.length ?? 0) > 0 && (
          <div className="legend-row"><span className="sw sw-camera" /> Camera from another instrument</div>
        )}
        <div className="legend-row faint">Drag to orbit, scroll to zoom</div>
      </div>
    </>
  )
}

/**
 * A model that fails to load (a broken or non-glTF file, an unreachable URL)
 * must not take the whole tool down: show the procedural massing instead and
 * say why. A different model resets it.
 */
class ModelErrorBoundary extends Component<
  { resetKey: string; fallback: ReactNode; children: ReactNode },
  { failed: boolean; key: string }
> {
  state = { failed: false, key: this.props.resetKey }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }
  componentDidCatch() {
    useStore.getState().notify('That model could not be loaded; showing the procedural massing instead.')
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
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
 * The camera's own photograph laid over the model seen from it. The image spans
 * the view's full width, because the camera's field of view is horizontal, so
 * when the pose is right the model's edges sit on the photograph's.
 */
function PhotoOverlay({ blobKey }: { blobKey: string }) {
  const url = useMediaUrl(blobKey)
  const opacity = useStore((s) => s.overlayOpacity)
  if (!url) return null
  return (
    <div className="photo-overlay" aria-hidden="true">
      <img src={url} alt="" style={{ opacity }} />
    </div>
  )
}

/** Where an imported camera stands in model space, and which way it looks. */
export function cameraPose(g: ModelGeoref, cam: RefCamera, eyeM: number) {
  const p = geoToModel(g, cam)
  const d = bearingToModelDir(g, cam.bearingDeg)
  const y = metresToUnits(g, eyeM)
  return { pos: new THREE.Vector3(p.x, y, p.z), dir: new THREE.Vector3(d.x, 0, d.z) }
}

/**
 * The cameras brought in from Sightlines and Atlas, standing in the model at
 * eye height, each with its field of view drawn as a frustum. Working reference
 * only: none of this publishes.
 */
function Cameras({ colours: C }: { colours: SceneColours }) {
  const testimony = useStore((s) => s.project.testimony)
  const selectedCameraId = useStore((s) => s.selectedCameraId)
  const lookThroughId = useStore((s) => s.lookThroughId)
  const g = effectiveGeoref(testimony)
  if (!g) return null
  const eye = testimony.cameraEyeHeightM ?? 1.6
  return (
    <>
      {allCameras(testimony).map(({ camera }) => {
        if (camera.id === lookThroughId) return null
        const { pos, dir } = cameraPose(g, camera, eye)
        const sel = camera.id === selectedCameraId
        const colour = sel ? C.focus : camera.consent === 'public' ? C.camera : C.withheld
        const len = metresToUnits(g, 14)
        const h = ((camera.fovDeg ?? 50) / 2) * (Math.PI / 180)
        const half = Math.tan(h) * len
        const vhalf = half * 0.75
        const side = new THREE.Vector3(-dir.z, 0, dir.x)
        const far = pos.clone().add(dir.clone().multiplyScalar(len))
        const corners = [
          far.clone().add(side.clone().multiplyScalar(half)).add(new THREE.Vector3(0, vhalf, 0)),
          far.clone().add(side.clone().multiplyScalar(-half)).add(new THREE.Vector3(0, vhalf, 0)),
          far.clone().add(side.clone().multiplyScalar(-half)).add(new THREE.Vector3(0, -vhalf, 0)),
          far.clone().add(side.clone().multiplyScalar(half)).add(new THREE.Vector3(0, -vhalf, 0)),
        ]
        const pts: THREE.Vector3[] = []
        for (const c of corners) pts.push(pos, c)
        const rim = [...corners, corners[0]]
        return (
          <group key={camera.id}>
            <mesh
              position={pos}
              onPointerDown={(e) => {
                e.stopPropagation()
                useStore.getState().selectCamera(camera.id)
              }}
            >
              <sphereGeometry args={[metresToUnits(g, sel ? 0.9 : 0.6), 16, 12]} />
              <meshBasicMaterial color={colour} />
            </mesh>
            <Line points={pts} segments color={colour} lineWidth={sel ? 2 : 1} transparent opacity={0.85} />
            <Line points={rim} color={colour} lineWidth={sel ? 2 : 1} transparent opacity={0.85} />
            {sel && (
              <Html position={pos} center style={{ pointerEvents: 'none' }}>
                <div className="model-label">{camera.label}</div>
              </Html>
            )}
          </group>
        )
      })}
    </>
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

  const lastLook = useRef<string | null>(null)

  useFrame((state) => {
    const st = useStore.getState()
    const cam = state.camera as THREE.PerspectiveCamera
    const lookControls = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null

    // Looking through an imported camera: stand where it stood, face where it
    // faced, and see as wide as it saw.
    const lookId = st.lookThroughId
    if (lookId) {
      const g = effectiveGeoref(st.project.testimony)
      const hit = allCameras(st.project.testimony).find((c) => c.camera.id === lookId)
      if (g && hit && lookControls?.target) {
        // The pose being matched, or the recorded one.
        const d = st.matchDraft
        const eye = d?.eyeM ?? st.project.testimony.cameraEyeHeightM ?? 1.6
        const posed = d ? { ...hit.camera, bearingDeg: d.headingDeg, fovDeg: d.fovDeg } : hit.camera
        const { pos, dir } = cameraPose(g, posed, eye)
        const pitch = ((d?.pitchDeg ?? 0) * Math.PI) / 180
        dir.multiplyScalar(Math.cos(pitch)).setY(Math.sin(pitch))
        const target = pos.clone().add(dir.multiplyScalar(metresToUnits(g, 30)))
        hit.camera = posed
        cam.position.lerp(pos, lastLook.current === lookId ? 0.25 : 0.12)
        lookControls.target.lerp(target, lastLook.current === lookId ? 0.25 : 0.12)
        const hfov = (hit.camera.fovDeg ?? 50) * (Math.PI / 180)
        const vfov = (2 * Math.atan(Math.tan(hfov / 2) / cam.aspect) * 180) / Math.PI
        if (Math.abs(cam.fov - vfov) > 0.01) {
          cam.fov = vfov
          cam.updateProjectionMatrix()
        }
        lookControls.update()
        if (cam.position.distanceTo(pos) < 0.02) lastLook.current = lookId
        return
      }
    } else if (lastLook.current !== null || cam.fov !== 45) {
      lastLook.current = null
      cam.fov = 45
      cam.updateProjectionMatrix()
    }

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
