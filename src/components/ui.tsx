import * as Select from '@radix-ui/react-select'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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
      {hint && <span className="faint" style={{ fontSize: 13 }}>{hint}</span>}
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
      {label && <span style={{ fontSize: 14 }}>{label}</span>}
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
        <Select.Icon>
          <span className="select-chevron" aria-hidden="true" />
        </Select.Icon>
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

const CONSENT_WORD: Record<Consent, string> = {
  public: 'Public',
  restricted: 'Restricted',
  embargoed: 'Embargoed',
}
const CERTAINTY_WORD: Record<Certainty, string> = {
  attested: 'Attested',
  probable: 'Probable',
  uncertain: 'Uncertain',
}

/** Consent as a word in the running text; withheld states read in the alert colour. */
export function ConsentBadge({ consent }: { consent: Consent }) {
  return <span className={`badge badge-${consent}`}>{CONSENT_WORD[consent]}</span>
}

export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  return <span className={`badge badge-${certainty}`}>{CERTAINTY_WORD[certainty]}</span>
}

const ROLE_LABEL: Record<NarratorRole, string> = {
  witness: 'Witness',
  survivor: 'Survivor',
  artist: 'Artist',
  elder: 'Elder',
  family: 'Family member',
  expert: 'Expert',
  official: 'Official',
  other: 'Other',
}

export function roleLabel(role: NarratorRole): string {
  return ROLE_LABEL[role]
}

export function RoleBadge({ role }: { role: NarratorRole }) {
  return <span>{ROLE_LABEL[role]}</span>
}

/** Words joined with a middle dot, skipping the empty ones: "Witness · Public". */
export function Meta({ parts }: { parts: ReactNode[] }) {
  const kept = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  return (
    <>
      {kept.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </>
  )
}

/** What each consent level means for a statement or a model. */
export const CONSENT_MEANING: Record<Consent, string> = {
  public: 'Published with the testimony.',
  restricted: 'Kept in the project; never published.',
  embargoed: 'Held for the account only; never published.',
}

/** What each consent level means for a narrator's identity. */
export const IDENTITY_MEANING: Record<Consent, string> = {
  public: 'Named in the published testimony.',
  restricted: 'Reduced to an alias (Narrator A) in anything published; name and affiliation withheld.',
  embargoed: 'Reduced to an alias in anything published; name and affiliation withheld.',
}

/** Consent as a choice, each option with its meaning beside it. */
export function ConsentChoice({
  value,
  onChange,
  meanings = CONSENT_MEANING,
  label = 'Who may see this',
}: {
  value: Consent
  onChange: (c: Consent) => void
  meanings?: Record<Consent, string>
  label?: string
}) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {(Object.keys(CONSENT_WORD) as Consent[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          className="choice-item"
          aria-checked={value === c}
          data-tone={c === 'public' ? undefined : 'alert'}
          onClick={() => onChange(c)}
        >
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <span className="choice-name">{CONSENT_WORD[c]}</span>
            <span className="choice-desc">{meanings[c]}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export interface MenuEntry {
  label: string
  hint?: string
  onSelect?: () => void
  checked?: boolean
  danger?: boolean
  heading?: boolean
  separator?: boolean
  disabled?: boolean
}

/**
 * A small accessible menu: a button that opens a list of actions. Escape and a
 * click outside close it; arrow keys move between items.
 */
export function Menu({
  label,
  entries,
  align = 'right',
}: {
  label: string
  entries: MenuEntry[]
  /** Which edge of the button the list lines up with. */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  const button = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    const first = wrap.current?.querySelector<HTMLButtonElement>('.menu-item:not(:disabled)')
    first?.focus()
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      button.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('.menu-item:not(:disabled)') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div className="menu-wrap" ref={wrap} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className="menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className={`menu menu-${align}`} role="menu" aria-label={label}>
          {entries.map((e, i) =>
            e.separator ? (
              <div key={i} className="menu-sep" role="separator" />
            ) : e.heading ? (
              <div key={i} className="menu-heading">
                {e.label}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role={e.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={e.checked}
                className={`menu-item${e.danger ? ' danger' : ''}`}
                disabled={e.disabled}
                onClick={() => {
                  setOpen(false)
                  e.onSelect?.()
                }}
              >
                <span>{e.label}</span>
                {e.hint && <span className="hint">{e.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
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
            aria-label="Remove this language"
            title="Remove this language"
          >
            Remove
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
  { value: 'public', label: 'Public' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'embargoed', label: 'Embargoed' },
]

export const CERTAINTY_OPTIONS: EnumOption<Certainty>[] = [
  { value: 'attested', label: 'Attested' },
  { value: 'probable', label: 'Probable' },
  { value: 'uncertain', label: 'Uncertain' },
]

export const PRECISION_OPTIONS = [
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'approximate', label: 'Approximate' },
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
