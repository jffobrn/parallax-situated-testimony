import { useState } from 'react'
import { type Narrator } from '../core'
import { useStore } from '../state/store'
import { CONSENT_OPTIONS, Dir, EnumSeg, Field, ROLE_OPTIONS, SelectMenu } from '../components/ui'

const IDENTITY_NOTE: Record<Narrator['identityConsent'], string> = {
  public: 'Named in the published testimony.',
  restricted: 'Reduced to an alias (Narrator A) in anything published; name and affiliation withheld.',
  embargoed: 'Reduced to an alias in anything published; name and affiliation withheld.',
}

export function NarratorEditor({ narrator }: { narrator: Narrator }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const id = narrator.id
  const patch = (partial: Partial<Narrator>) => useStore.getState().updateNarrator(id, partial)

  return (
    <div className="panel-body" style={{ paddingTop: 12 }}>
      <Field label="Name" hint="The narrator's real name. Published only when the identity is public.">
        <input
          className="input"
          dir={narrator.name ? undefined : 'ltr'}
          value={narrator.name ?? ''}
          placeholder="Name"
          onChange={(e) => patch({ name: e.target.value || undefined })}
        />
      </Field>

      <Field label="Role">
        <SelectMenu
          value={narrator.role}
          options={ROLE_OPTIONS}
          onChange={(v) => patch({ role: v })}
          ariaLabel="narrator role"
        />
      </Field>

      <Field label="Affiliation" hint="Withheld from anything published unless the identity is public.">
        <input
          className="input"
          value={narrator.affiliation ?? ''}
          onChange={(e) => patch({ affiliation: e.target.value || undefined })}
        />
      </Field>

      <div className="divider" />
      <span className="label">Identity consent</span>
      <div style={{ height: 6 }} />
      <EnumSeg
        value={narrator.identityConsent}
        options={CONSENT_OPTIONS}
        onChange={(v) => patch({ identityConsent: v })}
      />
      <p
        className={narrator.identityConsent === 'public' ? 'faint' : 'alert'}
        style={{ fontSize: 11, marginTop: 6 }}
      >
        {IDENTITY_NOTE[narrator.identityConsent]}
      </p>

      <div className="divider" />
      <Field label="Note" hint="Private. Never published.">
        <textarea
          className="textarea"
          value={narrator.note ?? ''}
          onChange={(e) => patch({ note: e.target.value || undefined })}
        />
      </Field>

      <div className="divider" />
      {confirmDel ? (
        <div className="btn-row">
          <button className="btn btn-sm btn-danger" onClick={() => useStore.getState().removeNarrator(id)}>
            Confirm delete
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDel(true)}>
          Delete narrator
        </button>
      )}
      <p className="faint" style={{ fontSize: 11, marginTop: 8 }}>
        Statements by a deleted narrator are kept but unassigned.
      </p>
      <div style={{ height: 8 }} />
      <div className="row-sub" style={{ padding: 0 }}>
        <Dir text={narrator.name?.trim() || 'Unnamed'} /> &nbsp;/&nbsp; id {id}
      </div>
    </div>
  )
}
