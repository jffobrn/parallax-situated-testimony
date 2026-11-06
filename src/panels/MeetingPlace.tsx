import { useRef, useState } from 'react'
import { formatLatLng, newId, type ModelGeoref, type RefCamera } from '../core'
import { useStore } from '../state/store'
import { allCameras, cameraSetFromFile, effectiveGeoref } from '../lib/cameras'
import { ConsentBadge, Field } from '../components/ui'

const TOOL_LABEL = { sightlines: 'Sightlines', atlas: 'Atlas' } as const

/**
 * Tie the scene model to the ground: by typing its origin, scale, and rotation,
 * or by matching two points in the model with the same two on the map. The
 * procedural massing is tied to the testimony's place by default.
 */
export function GeorefFields() {
  const testimony = useStore((s) => s.project.testimony)
  const setModel = useStore((s) => s.setModel)
  const model = testimony.model
  const g = effectiveGeoref(testimony)
  const own = model?.georef

  const set = (partial: Partial<ModelGeoref>) => {
    const base: ModelGeoref = own ?? g ?? {
      origin: testimony.place ? { lat: testimony.place.lat, lng: testimony.place.lng } : { lat: 0, lng: 0 },
      metresPerUnit: 1,
      rotationDeg: 0,
      basis: 'typed',
    }
    setModel({
      ...(model ?? { id: newId('mdl'), title: 'Scene model', kind: 'procedural', consent: 'public' }),
      georef: { ...base, ...partial, basis: 'typed', misfitPct: undefined },
    })
  }
  const num = (v: string, f: (n: number) => void) => {
    const n = parseFloat(v)
    if (Number.isFinite(n)) f(n)
  }

  return (
    <>
      <span className="label">Georeference</span>
      <p className="faint" style={{ fontSize: 13, margin: '4px 0 8px' }}>
        Ties the model's own space to the ground, so camera positions from Sightlines and Atlas can stand in
        it. Match two points, or type the values.
      </p>
      <p style={{ fontSize: 13, marginBottom: 8 }}>
        {g
          ? g.basis === 'procedural'
            ? 'The procedural massing is tied to the testimony place: one unit per metre, north up.'
            : g.basis === 'two-point'
              ? 'Set from two matched points.'
              : 'Set by hand.'
          : 'Not georeferenced yet. Give the testimony a place, or match two points.'}
      </p>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => useStore.getState().startGeorefMatch()}>
          Match two points
        </button>
        {own && (
          <button
            className="btn btn-sm btn-ghost btn-danger"
            onClick={() => model && setModel({ ...model, georef: undefined })}
          >
            Clear
          </button>
        )}
      </div>
      {g && (
        <>
          <Field label="Origin" hint="Where the model's 0, 0, 0 stands on the ground.">
            <div className="field-row">
              <input
                className="input input-mono"
                aria-label="origin latitude"
                defaultValue={g.origin.lat.toFixed(6)}
                key={`lat-${g.origin.lat}`}
                onBlur={(e) => num(e.target.value, (lat) => set({ origin: { ...g.origin, lat } }))}
              />
              <input
                className="input input-mono"
                aria-label="origin longitude"
                defaultValue={g.origin.lng.toFixed(6)}
                key={`lng-${g.origin.lng}`}
                onBlur={(e) => num(e.target.value, (lng) => set({ origin: { ...g.origin, lng } }))}
              />
            </div>
          </Field>
          <Field label="Metres per unit">
            <input
              className="input input-mono"
              defaultValue={g.metresPerUnit.toPrecision(5)}
              key={`m-${g.metresPerUnit}`}
              onBlur={(e) => num(e.target.value, (n) => n > 0 && set({ metresPerUnit: n }))}
            />
          </Field>
          <Field label="Rotation" hint="The bearing the model's north (minus z) points to, degrees clockwise from true north.">
            <input
              className="input input-mono"
              defaultValue={g.rotationDeg.toFixed(1)}
              key={`r-${g.rotationDeg}`}
              onBlur={(e) => num(e.target.value, (n) => set({ rotationDeg: ((n % 360) + 360) % 360 }))}
            />
          </Field>
        </>
      )}
    </>
  )
}

/**
 * Bring in camera positions from a Sightlines or Atlas project file: where each
 * photograph was taken, which way it faced, how wide it saw. Working reference
 * only; none of it is published from this tool.
 */
export function CameraSetsFields() {
  const testimony = useStore((s) => s.project.testimony)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const sets = testimony.cameraSets ?? []

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const res = await cameraSetFromFile(file)
    if (typeof res === 'string') {
      setMsg(res)
      return
    }
    useStore.getState().addCameraSet(res)
    setMsg(`${res.cameras.length} camera${res.cameras.length === 1 ? '' : 's'} from ${res.title}.`)
  }

  return (
    <>
      <span className="label">Cameras from other instruments</span>
      <p className="faint" style={{ fontSize: 13, margin: '4px 0 8px' }}>
        The camera positions placed in a Sightlines or Atlas project, brought into the model so you can see
        where each photograph was taken from and look through it. The file is cited by its hash; the cameras
        are working reference and are never published from here.
      </p>
      <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
        Add cameras from a project file
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {msg && <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>{msg}</p>}
      {sets.map((cs) => (
        <div key={cs.id} className="note-box" style={{ marginTop: 8 }}>
          <div className="between">
            <b>{cs.title}</b>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => useStore.getState().removeCameraSet(cs.id)}>
              Remove
            </button>
          </div>
          <div style={{ fontSize: 13 }}>
            {TOOL_LABEL[cs.tool]}, {cs.cameras.length} camera{cs.cameras.length === 1 ? '' : 's'}, from {cs.fileName}
          </div>
          <div className="hash">sha-256 {cs.sha256}</div>
        </div>
      ))}
      {sets.length > 0 && (
        <Field label="Eye height" hint="Metres above the ground the cameras stand at.">
          <input
            className="input input-mono"
            type="number"
            min={0}
            step={0.1}
            value={testimony.cameraEyeHeightM ?? 1.6}
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              if (Number.isFinite(n) && n >= 0) useStore.getState().setEyeHeight(n)
            }}
          />
        </Field>
      )}
    </>
  )
}

/** Properties of one imported camera, with the look-through action. */
export function CameraPanel({ camera }: { camera: RefCamera }) {
  const testimony = useStore((s) => s.project.testimony)
  const lookThroughId = useStore((s) => s.lookThroughId)
  const hit = allCameras(testimony).find((c) => c.camera.id === camera.id)
  const g = effectiveGeoref(testimony)
  const looking = lookThroughId === camera.id
  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button
          className={`btn btn-sm${looking ? '' : ' btn-primary'}`}
          disabled={!g}
          title={g ? 'Stand where this camera stood, in the model' : 'Georeference the model first'}
          onClick={() => useStore.getState().setLookThrough(looking ? null : camera.id)}
        >
          {looking ? 'Return to orbit' : 'Look through'}
        </button>
        <button className="btn btn-sm" onClick={() => useStore.getState().setView('map')}>
          Show on map
        </button>
      </div>
      {!g && <div className="warn" style={{ marginBottom: 10 }}>Georeference the model to stand this camera in it.</div>}
      <dl className="kv">
        <dt>From</dt>
        <dd>{hit ? `${TOOL_LABEL[hit.set.tool]}, ${hit.set.title}` : ''}</dd>
        <dt>Position</dt>
        <dd className="mono">{formatLatLng(camera.lat, camera.lng)}</dd>
        <dt>Facing</dt>
        <dd className="mono">{camera.bearingDeg.toFixed(1)}&deg;</dd>
        <dt>Field of view</dt>
        <dd className="mono">{camera.fovDeg !== undefined ? `${camera.fovDeg}°` : 'not recorded (50° assumed)'}</dd>
        <dt>Confidence</dt>
        <dd>{camera.confidence.charAt(0).toUpperCase() + camera.confidence.slice(1)}</dd>
        <dt>In its tool</dt>
        <dd>
          <ConsentBadge consent={camera.consent} />
          {camera.safeToPublish ? '' : ', position protected'}
        </dd>
      </dl>
      <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>
        Working reference from another instrument. Change it there and bring the file in again; nothing about
        this camera is published from Situated Testimony.
      </p>
    </div>
  )
}
