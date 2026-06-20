/**
 * The sovereignty editor: a rights-holder credit and a lean set of labels a
 * community may assign. The tool records and respects labels; it does not mint
 * official Local Contexts labels. Two labels restrict publication and are
 * enforced by the consent boundary; the editor says which, plainly.
 */

import {
  isRestrictingLabel,
  type LabelCode,
  type Sovereignty,
  type SovereigntyLabel,
} from '../core'
import { Field, LABEL_DEFAULT_TEXT, LABEL_OPTIONS, SelectMenu } from './ui'

export function SovereigntyEditor({
  value,
  onChange,
  rightsHolderHint,
}: {
  value: Sovereignty
  onChange: (next: Sovereignty) => void
  rightsHolderHint?: string
}) {
  const setLabel = (id: string, partial: Partial<SovereigntyLabel>) =>
    onChange({
      ...value,
      labels: value.labels.map((l, i) =>
        labelKey(l, i) === id ? { ...l, ...partial } : l,
      ),
    })
  const removeLabel = (id: string) =>
    onChange({ ...value, labels: value.labels.filter((l, i) => labelKey(l, i) !== id) })
  const addLabel = () =>
    onChange({
      ...value,
      labels: [
        ...value.labels,
        { code: 'attribution', text: LABEL_DEFAULT_TEXT.attribution },
      ],
    })

  return (
    <>
      <Field
        label="Rights-holder"
        hint={rightsHolderHint ?? 'Published as credit. Name a community or collective, not a protected individual.'}
      >
        <input
          className="input"
          value={value.rightsHolder ?? ''}
          placeholder="e.g. the contributing community"
          onChange={(e) => onChange({ ...value, rightsHolder: e.target.value || undefined })}
        />
      </Field>

      <span className="label">Labels</span>
      <p className="faint" style={{ fontSize: 11, margin: '4px 0 8px' }}>
        Labels a rights-holder has assigned. Shown labels appear as attribution;
        enforced labels withhold the item from anything published.
      </p>

      {value.labels.map((l, i) => {
        const key = labelKey(l, i)
        const enforced = isRestrictingLabel(l.code)
        return (
          <div key={key} className="sov-label">
            <div className="sov-label-head">
              <SelectMenu<LabelCode>
                value={l.code}
                options={LABEL_OPTIONS}
                ariaLabel="label kind"
                onChange={(code) =>
                  setLabel(key, {
                    code,
                    text: l.text || LABEL_DEFAULT_TEXT[code],
                  })
                }
              />
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => removeLabel(key)}
                aria-label="remove label"
              >
                &times;
              </button>
            </div>
            <input
              className="input"
              value={l.text}
              placeholder="Label wording"
              onChange={(e) => setLabel(key, { text: e.target.value })}
            />
            <span className={enforced ? 'sov-flag alert' : 'sov-flag faint'}>
              {enforced ? 'enforced: withheld from the public build' : 'shown as attribution'}
            </span>
          </div>
        )
      })}

      <button className="btn btn-sm btn-ghost" onClick={addLabel} style={{ marginTop: 4 }}>
        Add label
      </button>
    </>
  )
}

// Labels have no stable id of their own; index plus code is stable enough as a
// React key within one render list.
function labelKey(l: SovereigntyLabel, i: number): string {
  return `${i}:${l.code}`
}
