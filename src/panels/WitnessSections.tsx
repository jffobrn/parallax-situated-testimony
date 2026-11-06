import { useState } from 'react'
import {
  newId,
  type Basis,
  type Certainty,
  type Correction,
  type CorrectionBy,
  type CorrectionKind,
  type ElicitationMode,
  type ReviewMethod,
  type ReviewStatus,
  type Statement,
} from '../core'
import { useStore } from '../state/store'
import { viewpointBridge } from '../model/viewpointBridge'
import { CERTAINTY_OPTIONS, EnumSeg, Field, SelectMenu } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

const MODE_OPTIONS: { value: ElicitationMode; label: string }[] = [
  { value: 'free-recall', label: 'Free recall' },
  { value: 'model-assisted', label: 'With the model' },
  { value: 'prompted', label: 'Prompted' },
  { value: 'unrecorded', label: 'Not recorded' },
]
const MODE_MEANING: Record<ElicitationMode, string> = {
  'free-recall': 'Given before the model or any image was shown.',
  'model-assisted': 'Given with the 3D model on screen; the view is logged.',
  prompted: 'Given in response to a document or image.',
  unrecorded: 'How it was given was not noted at the time.',
}

const BASIS_OPTIONS: { value: Basis; label: string }[] = [
  { value: 'perceived', label: 'Perceived' },
  { value: 'inferred', label: 'Inferred' },
  { value: 'hearsay', label: 'Heard from others' },
]

const REVIEW: { value: ReviewStatus; label: string; meaning: string }[] = [
  { value: 'unreviewed', label: 'Not yet reviewed', meaning: 'Held back from publication until the narrator has reviewed it.' },
  { value: 'agreed', label: 'Agreed', meaning: 'The narrator agreed to these words as they stand.' },
  { value: 'agreed-with-changes', label: 'Agreed with changes', meaning: 'Agreed once revised; the changes are in the correction log.' },
  { value: 'withdrawn', label: 'Withdrawn', meaning: 'The narrator withdrew it. It never publishes.' },
]

const METHOD_OPTIONS: { value: ReviewMethod; label: string }[] = [
  { value: 'read-back', label: 'Read back to the narrator' },
  { value: 'shown-model', label: 'Shown with the model' },
  { value: 'in-writing', label: 'In writing' },
  { value: 'other', label: 'Other' },
]

const KIND_LABEL: Record<CorrectionKind, string> = {
  correction: 'Correction',
  negation: 'Negation',
  addition: 'Addition',
  withdrawal: 'Withdrawal',
}
const BY_LABEL: Record<CorrectionBy, string> = {
  narrator: 'Narrator',
  interviewer: 'Interviewer',
  interpreter: 'Interpreter',
}

function usePatch(statement: Statement) {
  return (partial: Partial<Statement>) => useStore.getState().updateStatement(statement.id, partial)
}

/** How the statement was given, what it rests on, and how firmly it is held. */
export function HowGiven({ statement }: { statement: Statement }) {
  const patch = usePatch(statement)
  const [msg, setMsg] = useState<string | null>(null)
  const el = statement.elicitation
  const mode = el?.mode ?? 'unrecorded'

  const logView = () => {
    const vp = viewpointBridge.capture()
    if (vp) {
      patch({ elicitation: { mode: 'model-assisted', prompt: el?.prompt, viewpoint: vp, loggedAt: new Date().toISOString() } })
      setMsg('The view on screen is logged.')
    } else {
      useStore.getState().setView('model')
      setMsg('Open the model view, then log the view.')
    }
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <>
      <div className="divider" />
      <span className="label">How it was given</span>
      <p className="faint" style={{ fontSize: 13, margin: '4px 0 8px' }}>
        A model can prompt memory as well as record it. Note whether these words came before the model
        was shown, with it on screen, or in response to a document or image.
      </p>
      <Field label="Given">
        <EnumSeg<ElicitationMode>
          value={mode}
          options={MODE_OPTIONS}
          onChange={(v) => patch({ elicitation: { ...el, mode: v } })}
        />
      </Field>
      <p className="faint" style={{ fontSize: 13, marginTop: -4 }}>{MODE_MEANING[mode]}</p>
      {mode === 'prompted' && (
        <Field label="Prompted by" hint="The document or image shown. Published with the statement.">
          <input
            className="input"
            value={el?.prompt ?? ''}
            onChange={(e) => patch({ elicitation: { ...el, mode, prompt: e.target.value || undefined } })}
          />
        </Field>
      )}
      {mode === 'model-assisted' && (
        <>
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn btn-sm" onClick={logView}>
              {el?.viewpoint ? 'Log the view again' : 'Log the view on screen'}
            </button>
          </div>
          <p className="faint" style={{ fontSize: 13, marginTop: 6 }}>
            {msg ??
              (el?.viewpoint && el.loggedAt
                ? `View logged ${el.loggedAt.slice(0, 16).replace('T', ' ')} UTC. Kept in the project, never published.`
                : 'No view logged yet.')}
          </p>
        </>
      )}

      <Field label="Rests on" hint="What the narrator saw or heard, worked out, or was told by others.">
        <EnumSeg<Basis>
          value={statement.basis ?? ('' as Basis)}
          options={BASIS_OPTIONS}
          onChange={(v) => patch({ basis: statement.basis === v ? undefined : v })}
        />
      </Field>
      <Field
        label="Held"
        hint="How firmly the narrator holds this. A gap or hesitation in a traumatic memory is not unreliability; record it in the correction log, not here."
      >
        <EnumSeg<Certainty>
          value={statement.certainty}
          options={CERTAINTY_OPTIONS}
          onChange={(v) => patch({ certainty: v })}
        />
      </Field>
    </>
  )
}

/** The narrator's own review: only an agreed statement crosses the boundary. */
export function Review({ statement }: { statement: Statement }) {
  const patch = usePatch(statement)
  const r = statement.review ?? { status: 'unreviewed' as ReviewStatus }
  return (
    <>
      <div className="divider" />
      <span className="label">Narrator review</span>
      <p className="faint" style={{ fontSize: 13, margin: '4px 0 8px' }}>
        The narrator signs off before anything is published.
      </p>
      <div className="choice" role="radiogroup" aria-label="Narrator review">
        {REVIEW.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            className="choice-item"
            aria-checked={r.status === o.value}
            data-tone={o.value === 'agreed' || o.value === 'agreed-with-changes' ? undefined : 'alert'}
            onClick={() =>
              patch({
                review: {
                  ...r,
                  status: o.value,
                  on: o.value === 'unreviewed' ? undefined : r.on ?? today(),
                },
              })
            }
          >
            <span className="choice-dot" aria-hidden="true" />
            <span>
              <span className="choice-name">{o.label}</span>
              <span className="choice-desc">{o.meaning}</span>
            </span>
          </button>
        ))}
      </div>
      {r.status !== 'unreviewed' && (
        <div style={{ marginTop: 8 }}>
          <Field label="Reviewed on">
            <input
              className="input input-mono"
              type="date"
              value={r.on ?? ''}
              onChange={(e) => patch({ review: { ...r, on: e.target.value || undefined } })}
            />
          </Field>
          <Field label="How">
            <SelectMenu<ReviewMethod>
              value={r.how ?? 'read-back'}
              options={METHOD_OPTIONS}
              onChange={(v) => patch({ review: { ...r, how: v } })}
              ariaLabel="review method"
            />
          </Field>
        </div>
      )}
    </>
  )
}

/**
 * The append-only correction log. Entries are added and may be superseded with
 * a reason, never deleted: the witness's revisions are part of the evidence.
 */
export function CorrectionLog({ statement }: { statement: Statement }) {
  const patch = usePatch(statement)
  const log = statement.corrections ?? []
  const [kind, setKind] = useState<CorrectionKind>('correction')
  const [by, setBy] = useState<CorrectionBy>('narrator')
  const [at, setAt] = useState(today())
  const [text, setText] = useState('')
  const [superseding, setSuperseding] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const add = () => {
    if (!text.trim()) return
    const entry: Correction = { id: newId('cor'), at, by, kind, text: text.trim() }
    patch({ corrections: [...log, entry] })
    setText('')
  }
  const supersede = (id: string) => {
    if (!reason.trim()) return
    patch({ corrections: log.map((c) => (c.id === id ? { ...c, supersededReason: reason.trim() } : c)) })
    setSuperseding(null)
    setReason('')
  }

  return (
    <>
      <div className="divider" />
      <span className="label">Correction log</span>
      <p className="faint" style={{ fontSize: 13, margin: '4px 0 8px' }}>
        Corrections and negations ("not there", "not like that") as the narrator gives them. Entries are
        never deleted; they publish beside the statement.
      </p>
      {log.length === 0 && <div className="empty" style={{ paddingLeft: 0 }}>No entries yet.</div>}
      {log.map((c) => (
        <div key={c.id} className="correction" data-superseded={!!c.supersededReason}>
          <div className="correction-head">
            <span>
              <b>{KIND_LABEL[c.kind]}</b>, {BY_LABEL[c.by].toLowerCase()}, <span className="mono">{c.at}</span>
            </span>
            {!c.supersededReason && superseding !== c.id && (
              <button className="btn-link" onClick={() => setSuperseding(c.id)}>
                Supersede
              </button>
            )}
          </div>
          <div className="correction-text">{c.text}</div>
          {c.supersededReason && <div className="faint" style={{ fontSize: 13 }}>Superseded: {c.supersededReason}</div>}
          {superseding === c.id && (
            <div className="btn-row" style={{ marginTop: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Why it is superseded"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Reason"
              />
              <button className="btn btn-sm" onClick={() => supersede(c.id)} disabled={!reason.trim()}>
                Mark superseded
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setSuperseding(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="correction-add">
        <Field label="Kind">
          <SelectMenu<CorrectionKind>
            value={kind}
            options={(Object.keys(KIND_LABEL) as CorrectionKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            onChange={setKind}
            ariaLabel="correction kind"
          />
        </Field>
        <Field label="By">
          <SelectMenu<CorrectionBy>
            value={by}
            options={(Object.keys(BY_LABEL) as CorrectionBy[]).map((k) => ({ value: k, label: BY_LABEL[k] }))}
            onChange={setBy}
            ariaLabel="made by"
          />
        </Field>
        <Field label="On">
          <input className="input input-mono" type="date" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Field label="Words">
          <textarea
            className="textarea"
            value={text}
            placeholder="Not by the wall: by the steps."
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <button className="btn btn-sm" onClick={add} disabled={!text.trim()}>
          Add to the log
        </button>
      </div>
    </>
  )
}
