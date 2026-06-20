import { useState } from 'react'
import {
  formatDateTime,
  type Anchor,
  type Certainty,
  type Statement,
  type TimePrecision,
} from '../core'
import { useStore } from '../state/store'
import { PointFields } from '../components/points'
import { SovereigntyEditor } from '../components/Sovereignty'
import {
  CERTAINTY_OPTIONS,
  CONSENT_OPTIONS,
  Dir,
  EnumSeg,
  Field,
  LocalizedTextEditor,
  PRECISION_OPTIONS,
  SelectMenu,
} from '../components/ui'

const CONSENT_NOTE: Record<Statement['consent'], string> = {
  public: 'Included in exports and the published testimony.',
  restricted: 'Kept in your project file, withheld from anything published.',
  embargoed: 'Kept in your project file, withheld from anything published.',
}

function fmtClock(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return '--:--'
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function StatementEditor({ statement }: { statement: Statement }) {
  const project = useStore((s) => s.project)
  const placing = useStore((s) => s.placing)
  const setPlacing = useStore((s) => s.setPlacing)
  const playheadSec = useStore((s) => s.playheadSec)
  const [confirmDel, setConfirmDel] = useState(false)

  const id = statement.id
  const patch = (partial: Partial<Statement>) => useStore.getState().updateStatement(id, partial)
  const patchAnchor = (partial: Partial<Anchor>) =>
    patch({ anchor: { ...statement.anchor, ...partial } })

  const narratorOptions = [
    { value: '', label: 'Unassigned' },
    ...project.testimony.narrators.map((n) => ({
      value: n.id,
      label: n.name?.trim() || 'Unnamed narrator',
    })),
  ]

  const clip = statement.clip
  const setClip = (partial: Partial<NonNullable<Statement['clip']>>) =>
    patch({ clip: { startSec: clip?.startSec ?? 0, ...clip, ...partial } })

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={() => useStore.getState().setView('model')}>
          Show in model
        </button>
        <button className="btn btn-sm" onClick={() => useStore.getState().setView('map')}>
          Show on map
        </button>
        {clip && (
          <button className="btn btn-sm" onClick={() => useStore.getState().seek(clip.startSec)}>
            Cue recording
          </button>
        )}
      </div>

      <Field label="Narrator">
        <SelectMenu
          value={statement.narratorId ?? ''}
          options={narratorOptions}
          onChange={(v) => patch({ narratorId: v || undefined })}
          ariaLabel="narrator"
        />
      </Field>

      <div className="divider" />
      <span className="label">Words</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        The statement, one entry per language. Direction is detected per string.
      </p>
      <LocalizedTextEditor
        value={statement.text}
        onChange={(text) => patch({ text })}
        placeholder="What was said"
        multiline
        minRows={4}
      />

      <div className="divider" />
      <span className="label">Clip in the recording</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Where in the recording this is spoken. Set from the transport playhead.
      </p>
      <div className="field-row">
        <Field label={`Start  ${fmtClock(clip?.startSec)}`}>
          <div className="clip-row">
            <input
              className="input input-mono"
              type="number"
              min={0}
              step="0.1"
              value={clip?.startSec ?? ''}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (Number.isFinite(n)) setClip({ startSec: n })
                else if (e.target.value === '') patch({ clip: undefined })
              }}
            />
            <button
              className="btn btn-sm btn-ghost"
              title="set from playhead"
              onClick={() => setClip({ startSec: Math.round(playheadSec * 10) / 10 })}
            >
              ⤓
            </button>
          </div>
        </Field>
        <Field label={`End  ${fmtClock(clip?.endSec)}`}>
          <div className="clip-row">
            <input
              className="input input-mono"
              type="number"
              min={0}
              step="0.1"
              value={clip?.endSec ?? ''}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                setClip({ endSec: Number.isFinite(n) ? n : undefined })
              }}
              disabled={!clip}
            />
            <button
              className="btn btn-sm btn-ghost"
              title="set from playhead"
              disabled={!clip}
              onClick={() => setClip({ endSec: Math.round(playheadSec * 10) / 10 })}
            >
              ⤓
            </button>
          </div>
        </Field>
      </div>

      <div className="divider" />
      <span className="label">Refers to</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        The real-world time the memory is about (not when it was recorded). Drives
        the chronology.
      </p>
      <Field label="Datetime (ISO, UTC)">
        <input
          className="input input-mono"
          placeholder="1992-08-15T00:00:00Z"
          value={statement.refersTo?.value ?? ''}
          onChange={(e) => {
            const value = e.target.value.trim()
            if (!value) patch({ refersTo: undefined })
            else patch({ refersTo: { value, precision: statement.refersTo?.precision ?? 'day' } })
          }}
        />
      </Field>
      {statement.refersTo && (
        <>
          <Field label="Precision">
            <EnumSeg<TimePrecision>
              value={statement.refersTo.precision}
              options={PRECISION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(v) => patch({ refersTo: { value: statement.refersTo!.value, precision: v } })}
            />
          </Field>
          <p className="faint" style={{ fontSize: 11, marginTop: -4 }}>
            {formatDateTime(statement.refersTo.value, statement.refersTo.precision)}
          </p>
        </>
      )}

      <div className="divider" />
      <Field label="Certainty" hint="How reliable the memory is held to be.">
        <EnumSeg<Certainty>
          value={statement.certainty}
          options={CERTAINTY_OPTIONS}
          onChange={(v) => patch({ certainty: v })}
        />
      </Field>

      <div className="divider" />
      <span className="label">Anchor in the model</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        A point on the 3D scene where this memory attaches.
      </p>
      {statement.anchor?.model ? (
        <div className="between">
          <span className="mono" style={{ fontSize: 11 }}>
            x {statement.anchor.model.x.toFixed(2)} &nbsp; y {statement.anchor.model.y.toFixed(2)} &nbsp; z{' '}
            {statement.anchor.model.z.toFixed(2)}
          </span>
          <div className="btn-row">
            <button
              className={`btn btn-sm ${placing?.kind === 'statement-model' && placing.statementId === id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                useStore.getState().setView('model')
                setPlacing({ kind: 'statement-model', statementId: id })
              }}
            >
              Move in model
            </button>
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={() => patchAnchor({ model: undefined })}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`btn btn-sm ${placing?.kind === 'statement-model' && placing.statementId === id ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            useStore.getState().setView('model')
            setPlacing({ kind: 'statement-model', statementId: id })
          }}
        >
          {placing?.kind === 'statement-model' && placing.statementId === id
            ? 'Click the model...'
            : 'Place in model'}
        </button>
      )}

      <div className="divider" />
      <span className="label">Anchor on the map</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Where on the ground this memory attaches.
      </p>
      <PointFields
        point={statement.anchor?.geo}
        onChange={(p) => patchAnchor({ geo: p })}
        onRemove={() => patchAnchor({ geo: undefined })}
        onPlace={() => {
          useStore.getState().setView('map')
          setPlacing({ kind: 'statement-geo', statementId: id })
        }}
        placeLabel="Place on map"
        placingActive={placing?.kind === 'statement-geo' && placing.statementId === id}
      />

      <div className="divider" />
      <span className="label">Consent</span>
      <div style={{ height: 6 }} />
      <EnumSeg value={statement.consent} options={CONSENT_OPTIONS} onChange={(v) => patch({ consent: v })} />
      <p
        className={statement.consent === 'public' ? 'faint' : 'alert'}
        style={{ fontSize: 11, marginTop: 6 }}
      >
        {CONSENT_NOTE[statement.consent]}
      </p>

      <div className="divider" />
      <span className="label">Sovereignty</span>
      <div style={{ height: 6 }} />
      <SovereigntyEditor
        value={statement.sovereignty}
        onChange={(sovereignty) => patch({ sovereignty })}
        rightsHolderHint="Published as credit on this statement. Name a community or collective."
      />

      <div className="divider" />
      <Field label="Tags" hint="Comma separated.">
        <input
          className="input"
          value={statement.tags.join(', ')}
          onChange={(e) =>
            patch({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
      </Field>
      <Field label="Note" hint="Private. Never published.">
        <textarea
          className="textarea"
          value={statement.note ?? ''}
          onChange={(e) => patch({ note: e.target.value || undefined })}
        />
      </Field>

      <div className="divider" />
      <div className="btn-row">
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => useStore.getState().moveStatement(id, -1)}
        >
          Move up
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => useStore.getState().moveStatement(id, 1)}
        >
          Move down
        </button>
      </div>
      <div style={{ height: 8 }} />
      {confirmDel ? (
        <div className="btn-row">
          <button className="btn btn-sm btn-danger" onClick={() => useStore.getState().removeStatement(id)}>
            Confirm delete
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
          Delete statement
        </button>
      )}
      <div style={{ height: 8 }} />
      <div className="row-sub" style={{ padding: 0 }}>
        <Dir text={statement.text[0]?.text || 'Untitled'} /> &nbsp;/&nbsp; id {id}
      </div>
    </div>
  )
}
