import * as Select from '@radix-ui/react-select'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  dirOf,
  type Certainty,
  type Consent,
  type LabelCode,
  type LocalizedText,
  type NarratorRole,
  type RecordingMedium,
  type TestimonySubject,
} from '../core'

/**
 * Make a clickable row keyboard-activatable like a button: focusable, with Enter
 * or Space triggering the action. Spread onto the row element:
 *   <div className="row" {...rowButton(() => select(id))}>
 * A keypress that bubbles up from a nested control (a real button inside the
 * row) is ignored via the target/currentTarget guard, so secondary buttons keep
 * their own behaviour.
 */
export function rowButton(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault()
        onActivate()
      }
    },
  }
}

/** A stat readout: a bold count followed by its noun, pluralized to match. */
export function Count({ n, noun }: { n: number; noun: string }) {
  return (
    <>
      <b>{n}</b> {n === 1 ? noun : `${noun}s`}
    </>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
      {hint && <span className="faint" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
  )
}

/** Text that picks its own direction (and Arabic font) from its content. */
export function Dir({
  text,
  className,
  title,
}: {
  text: string
  className?: string
  title?: string
}) {
  return (
    <span dir={dirOf(text)} className={className} title={title}>
      {text}
    </span>
  )
}

export interface EnumOption<T extends string> {
  value: T
  label: string
}

/** A compact segmented control for short enums (precision, certainty, consent). */
export function EnumSeg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: EnumOption<T>[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
      {label && <span style={{ fontSize: 12 }}>{label}</span>}
    </button>
  )
}

/** Themed Radix Select for longer enums. */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: EnumOption<T>[]
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <Select.Trigger className="select-trigger" aria-label={ariaLabel}>
        <Select.Value />
        <Select.Icon>▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={4}>
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item key={o.value} value={o.value} className="select-item">
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

export function ConsentBadge({ consent }: { consent: Consent }) {
  return <span className={`badge badge-${consent}`}>{consent}</span>
}

export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  return <span className={`badge badge-${certainty}`}>{certainty}</span>
}

const ROLE_LABEL: Record<NarratorRole, string> = {
  witness: 'WITNESS',
  survivor: 'SURVIVOR',
  artist: 'ARTIST',
  elder: 'ELDER',
  family: 'FAMILY',
  expert: 'EXPERT',
  official: 'OFFICIAL',
  other: 'OTHER',
}

export function RoleBadge({ role }: { role: NarratorRole }) {
  return (
    <span className="row-sub" style={{ margin: 0 }}>
      <span className="kind-dot" />
      {ROLE_LABEL[role]}
    </span>
  )
}

/**
 * An editor for a list of multilingual texts (the testimony titles, a statement's
 * words). One row per language, direction detected per string.
 */
export function LocalizedTextEditor({
  value,
  onChange,
  placeholder = 'Text',
  multiline = false,
  minRows = 3,
}: {
  value: LocalizedText[]
  onChange: (next: LocalizedText[]) => void
  placeholder?: string
  multiline?: boolean
  minRows?: number
}) {
  const set = (i: number, partial: Partial<LocalizedText>) =>
    onChange(value.map((t, j) => (j === i ? { ...t, ...partial } : t)))
  const add = () => onChange([...value, { text: '', lang: 'en' }])
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))

  return (
    <>
      {value.map((t, i) => (
        <div key={i} className="lt-row">
          {multiline ? (
            <textarea
              className="textarea"
              dir={dirOf(t.text)}
              rows={minRows}
              value={t.text}
              placeholder={placeholder}
              onChange={(e) => set(i, { text: e.target.value })}
            />
          ) : (
            <input
              className="input"
              dir={dirOf(t.text)}
              value={t.text}
              placeholder={placeholder}
              onChange={(e) => set(i, { text: e.target.value })}
            />
          )}
          <input
            className="input input-mono lt-lang"
            value={t.lang}
            aria-label="language"
            onChange={(e) => set(i, { lang: e.target.value })}
          />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => remove(i)}
            disabled={value.length <= 1}
            aria-label="remove language"
          >
            &times;
          </button>
        </div>
      ))}
      <button className="btn btn-sm btn-ghost" onClick={add} style={{ marginTop: 4 }}>
        Add language
      </button>
    </>
  )
}

// Shared option lists.
export const CONSENT_OPTIONS: EnumOption<Consent>[] = [
  { value: 'public', label: 'PUBLIC' },
  { value: 'restricted', label: 'RESTRICTED' },
  { value: 'embargoed', label: 'EMBARGOED' },
]

export const CERTAINTY_OPTIONS: EnumOption<Certainty>[] = [
  { value: 'attested', label: 'ATTESTED' },
  { value: 'probable', label: 'PROBABLE' },
  { value: 'uncertain', label: 'UNCERTAIN' },
]

export const PRECISION_OPTIONS = [
  { value: 'minute', label: 'MIN' },
  { value: 'hour', label: 'HOUR' },
  { value: 'day', label: 'DAY' },
  { value: 'approximate', label: 'APPROX' },
] as const

export const SUBJECT_OPTIONS: EnumOption<TestimonySubject>[] = [
  { value: 'event', label: 'An event' },
  { value: 'place', label: 'A place' },
  { value: 'work', label: 'A work' },
  { value: 'life', label: 'A life' },
  { value: 'practice', label: 'A practice' },
]

export const ROLE_OPTIONS: EnumOption<NarratorRole>[] = [
  { value: 'witness', label: 'Witness' },
  { value: 'survivor', label: 'Survivor' },
  { value: 'artist', label: 'Artist' },
  { value: 'elder', label: 'Elder' },
  { value: 'family', label: 'Family member' },
  { value: 'expert', label: 'Expert' },
  { value: 'official', label: 'Official' },
  { value: 'other', label: 'Other' },
]

export const MEDIUM_OPTIONS: EnumOption<RecordingMedium>[] = [
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'transcript-only', label: 'Transcript only' },
]

export const LABEL_OPTIONS: EnumOption<LabelCode>[] = [
  { value: 'attribution', label: 'Attribution (shown)' },
  { value: 'non-commercial', label: 'Non-commercial (shown)' },
  { value: 'outreach', label: 'Outreach (shown)' },
  { value: 'community-use', label: 'Community use only (enforced)' },
  { value: 'withholding', label: 'Withholding (enforced)' },
  { value: 'custom', label: 'Custom label (shown)' },
]

export const LABEL_DEFAULT_TEXT: Record<LabelCode, string> = {
  attribution: 'Attribution',
  'non-commercial': 'Non-commercial',
  outreach: 'Outreach',
  'community-use': 'Community Use Only',
  withholding: 'Withholding',
  custom: '',
}
