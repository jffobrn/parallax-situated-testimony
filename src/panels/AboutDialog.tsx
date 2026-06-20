import * as Dialog from '@radix-ui/react-dialog'
import { APP_NAME, DISCLAIMER, SUITE_NAME, TAGLINE } from '../core'

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content ticks">
          <Dialog.Title className="dialog-title">
            {APP_NAME} <span className="faint">// {SUITE_NAME}</span>
          </Dialog.Title>
          <Dialog.Description className="dialog-desc">{TAGLINE}</Dialog.Description>

          <div className="prose" style={{ fontSize: 13 }}>
            <p style={{ marginBottom: 12 }}>
              Situated Testimony records an account as a sequence of time-coded
              statements and anchors each one in space: a point on a 3D model and a
              point on the map, ordered on a timeline. It is the suite&apos;s answer
              to Forensic Architecture&apos;s situated testimony, putting a witness
              back inside the place and recording where a memory attaches.
            </p>

            <span className="label">Three readings, one account</span>
            <p style={{ margin: '6px 0 12px' }}>
              Transcript, Model, and Map are three readings of the same statements,
              linked to a chronology and a recording transport. Scrub the recording
              or pick a statement and the model orbits to its anchor, the map flies
              to its place, and the chronology highlights its moment.
            </p>

            <span className="label">Consent and sovereignty by design</span>
            <p style={{ margin: '6px 0 12px' }}>
              One boundary function produces every export and every published view.
              It drops restricted and embargoed statements, withholds statements
              under a community-use or withholding label, aliases protected
              identities, withholds a non-public model, and cites the recording by
              hash rather than embedding the voice. Nothing sensitive can leak
              because it never crosses that boundary.
            </p>

            <div className="note-box">{DISCLAIMER}</div>

            <p className="faint" style={{ marginTop: 12, fontSize: 12 }}>
              Runs entirely in your browser. The project and its media stay on your
              machine in local storage; nothing is uploaded. The 3D model loads from
              a local file, and the basemap fetches no tiles. The bundled sample is
              plainly fictional.
            </p>
          </div>

          <Dialog.Close asChild>
            <button className="dialog-close" aria-label="Close">&times;</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
