import { useRef, useState } from 'react'
import {
  formatBytes,
  newId,
  type Recording,
  type SceneModel,
  type TestimonySubject,
  type TimePrecision,
} from '../core'
import { useStore } from '../state/store'
import { ingestFile } from '../lib/ingest'
import { findWaybackSnapshot } from '../lib/wayback'
import { PointFields } from '../components/points'
import { SovereigntyEditor } from '../components/Sovereignty'
import {
  CONSENT_OPTIONS,
  EnumSeg,
  Field,
  LocalizedTextEditor,
  MEDIUM_OPTIONS,
  PRECISION_OPTIONS,
  SelectMenu,
  SUBJECT_OPTIONS,
} from '../components/ui'

function fmtClock(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return '--:--'
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function TestimonyEditor() {
  const t = useStore((s) => s.project.testimony)
  const patch = useStore((s) => s.patchTestimony)
  const setPlacing = useStore((s) => s.setPlacing)
  const placing = useStore((s) => s.placing)

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <span className="label">Titles</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        One per language. Direction is detected per string.
      </p>
      <LocalizedTextEditor
        value={t.titles}
        onChange={(titles) => patch({ titles })}
        placeholder="Title"
      />

      <div className="divider" />
      <Field label="This testimony is of">
        <SelectMenu
          value={t.subject}
          options={SUBJECT_OPTIONS.map((o) => ({ value: o.value as TestimonySubject, label: o.label }))}
          onChange={(v) => patch({ subject: v })}
          ariaLabel="testimony subject"
        />
      </Field>

      <div className="divider" />
      <span className="label">Time window</span>
      <div style={{ height: 6 }} />
      <div className="field-row">
        <Field label="Start (ISO)">
          <input
            className="input input-mono"
            placeholder="1979-01-01"
            value={t.window.start ?? ''}
            onChange={(e) => patch({ window: { ...t.window, start: e.target.value || undefined } })}
          />
        </Field>
        <Field label="End (ISO)">
          <input
            className="input input-mono"
            placeholder="1995-01-01"
            value={t.window.end ?? ''}
            onChange={(e) => patch({ window: { ...t.window, end: e.target.value || undefined } })}
          />
        </Field>
      </div>
      <Field label="Window precision">
        <EnumSeg<TimePrecision>
          value={t.window.precision}
          options={PRECISION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => patch({ window: { ...t.window, precision: v } })}
        />
      </Field>

      <div className="divider" />
      <Field label="Summary">
        <textarea
          className="textarea"
          style={{ minHeight: 100 }}
          value={t.summary ?? ''}
          onChange={(e) => patch({ summary: e.target.value || undefined })}
        />
      </Field>
      <Field label="Tags" hint="Comma separated.">
        <input
          className="input"
          value={t.tags.join(', ')}
          onChange={(e) =>
            patch({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
      </Field>

      <div className="divider" />
      <span className="label">Place</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Where the testimony is situated. Anchors the map.
      </p>
      <Field label="Name">
        <input
          className="input"
          value={t.place?.name ?? ''}
          placeholder="Place name"
          onChange={(e) =>
            patch({
              place: t.place
                ? { ...t.place, name: e.target.value || undefined }
                : { lat: 0, lng: 0, safeToPublish: true, name: e.target.value || undefined },
            })
          }
        />
      </Field>
      <PointFields
        point={t.place}
        onChange={(p) => patch({ place: { ...p, name: t.place?.name } })}
        onRemove={() => patch({ place: undefined })}
        onPlace={() => setPlacing({ kind: 'testimony-place' })}
        placeLabel="Place on map"
        placingActive={placing?.kind === 'testimony-place'}
      />

      <div className="divider" />
      <RecordingFields />

      <div className="divider" />
      <ModelFields />

      <div className="divider" />
      <span className="label">Sovereignty</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        The umbrella rights-holder and labels for the whole testimony. Per-statement
        labels can narrow this further.
      </p>
      <SovereigntyEditor
        value={t.sovereignty}
        onChange={(sovereignty) => patch({ sovereignty })}
      />
    </div>
  )
}

function RecordingFields() {
  const recording = useStore((s) => s.project.testimony.recording)
  const setRecording = useStore((s) => s.setRecording)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [wb, setWb] = useState<string | null>(null)

  const ensure = (): Recording =>
    recording ?? { id: newId('rec'), medium: 'audio', title: 'Recording' }
  const patch = (partial: Partial<Recording>) => setRecording({ ...ensure(), ...partial })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('Hashing recording...')
    try {
      const held = await ingestFile(file)
      patch({ file: held, durationSec: held.durationSec })
    } finally {
      setBusy(null)
    }
  }

  const requestSnapshot = async () => {
    if (!recording?.link?.url) return
    setWb('Asking the Internet Archive...')
    try {
      const snap = await findWaybackSnapshot(recording.link.url)
      if (!snap) {
        setWb('No snapshot found for that URL.')
        return
      }
      patch({ link: { ...recording.link, ...snap } })
      setWb('Snapshot found and hashed.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setWb(
        /fetch|network|load failed/i.test(msg)
          ? 'Could not reach the Internet Archive (offline, blocked, or CORS). The link is saved; try again when online.'
          : msg || 'Lookup failed.',
      )
    }
  }

  return (
    <>
      <span className="label">Recording</span>
      <div style={{ height: 6 }} />
      <Field label="Medium">
        <EnumSeg
          value={recording?.medium ?? 'audio'}
          options={MEDIUM_OPTIONS}
          onChange={(v) => patch({ medium: v })}
        />
      </Field>
      <Field label="Title">
        <input
          className="input"
          value={recording?.title ?? ''}
          placeholder="Recording title"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>

      <input
        ref={fileInput}
        type="file"
        accept="audio/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {recording?.file ? (
        <dl className="kv" style={{ marginTop: 4 }}>
          <dt>Name</dt>
          <dd className="mono" style={{ fontSize: 11 }}>{recording.file.name}</dd>
          <dt>Size</dt>
          <dd className="mono">
            {formatBytes(recording.file.bytes)}
            {recording.file.durationSec ? ` / ${fmtClock(recording.file.durationSec)}` : ''}
          </dd>
          <dt>sha-256</dt>
          <dd className="hash">{recording.file.sha256}</dd>
        </dl>
      ) : null}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
          {busy ?? (recording?.file ? 'Replace recording' : 'Add recording file')}
        </button>
        {recording && (recording.file || recording.link) && (
          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setRecording(undefined)}>
            Remove
          </button>
        )}
      </div>
      <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>
        Held locally and hashed. The voice is never embedded in a published build,
        only cited by hash.
      </p>

      <div style={{ height: 10 }} />
      <Field label="Or a link (not downloaded)">
        <input
          className="input input-mono"
          placeholder="https://..."
          value={recording?.link?.url ?? ''}
          onChange={(e) =>
            patch({ link: e.target.value ? { ...recording?.link, url: e.target.value } : undefined })
          }
        />
      </Field>
      {recording?.link?.url && (
        <>
          <button className="btn btn-sm" onClick={requestSnapshot}>
            Request archived snapshot
          </button>
          {wb && <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>{wb}</p>}
          {recording.link.archivedSha256 && (
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Snapshot</dt>
              <dd className="hash">sha256:{recording.link.archivedSha256}</dd>
            </dl>
          )}
        </>
      )}
    </>
  )
}

function ModelFields() {
  const model = useStore((s) => s.project.testimony.model)
  const setModel = useStore((s) => s.setModel)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const ensure = (): SceneModel =>
    model ?? { id: newId('mdl'), title: 'Scene model', kind: 'procedural', consent: 'public' }
  const patch = (partial: Partial<SceneModel>) => setModel({ ...ensure(), ...partial })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('Hashing model...')
    try {
      const held = await ingestFile(file)
      patch({ file: held, kind: 'gltf' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <span className="label">Scene model</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        A glTF/glb the testimony is situated in. With none, a neutral procedural
        massing is shown. Statements anchor to points on it.
      </p>
      <Field label="Title">
        <input
          className="input"
          value={model?.title ?? ''}
          placeholder="Model title"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </Field>

      <input
        ref={fileInput}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {model?.file ? (
        <dl className="kv" style={{ marginTop: 4 }}>
          <dt>Name</dt>
          <dd className="mono" style={{ fontSize: 11 }}>{model.file.name}</dd>
          <dt>Size</dt>
          <dd className="mono">{formatBytes(model.file.bytes)}</dd>
          <dt>sha-256</dt>
          <dd className="hash">{model.file.sha256}</dd>
        </dl>
      ) : (
        <p className="faint" style={{ fontSize: 11 }}>Procedural massing (no file loaded).</p>
      )}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
          {busy ?? (model?.file ? 'Replace model' : 'Load glTF/glb')}
        </button>
        {(model?.file || model?.url) && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => patch({ file: undefined, url: undefined, kind: 'procedural' })}
          >
            Use procedural
          </button>
        )}
      </div>

      <div style={{ height: 10 }} />
      <Field label="Or load from a URL" hint="A glTF/glb the host serves cross-origin. Nothing is downloaded.">
        <input
          className="input input-mono"
          placeholder="https://example.org/scene.glb"
          value={model?.url ?? ''}
          onChange={(e) => {
            const v = e.target.value.trim()
            patch(
              v
                ? { url: v, kind: 'gltf', file: undefined }
                : { url: undefined, kind: model?.file ? 'gltf' : 'procedural' },
            )
          }}
        />
      </Field>

      <div style={{ height: 10 }} />
      <span className="label">Model consent</span>
      <div style={{ height: 6 }} />
      <EnumSeg
        value={model?.consent ?? 'public'}
        options={CONSENT_OPTIONS}
        onChange={(v) => patch({ consent: v })}
      />
      <p
        className={(model?.consent ?? 'public') === 'public' ? 'faint' : 'alert'}
        style={{ fontSize: 11, marginTop: 6 }}
      >
        {(model?.consent ?? 'public') === 'public'
          ? 'Cited in the published testimony; model anchors are kept.'
          : 'Withheld from anything published; model anchors are stripped from published statements.'}
      </p>
    </>
  )
}
