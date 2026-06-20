import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import { publicClone, redactionLines, type PublicProject } from '../core'
import { useStore } from '../state/store'
import { buildPublishedHtml } from './publish'
import { downloadText, slugify } from '../lib/download'

/**
 * The publish surface. It runs the project through publicClone, shows exactly
 * what the consent boundary removed (statements withheld by consent or by a
 * sovereignty label, narrators aliased, the model withheld, the recording media
 * held back), previews the resulting self-contained artifact in a sandboxed
 * frame, and offers it for download or print. The preview is the artifact: the
 * same HTML string is shown and saved.
 */
export function PublishDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const project = useStore((s) => s.project)
  const [pub, setPub] = useState<PublicProject | null>(null)
  const [html, setHtml] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!open) return
    setBusy(true)
    const cloned = publicClone(project, { generatedAt: new Date().toISOString() })
    const doc = buildPublishedHtml(cloned)
    setPub(cloned)
    setHtml(doc)
    setBusy(false)
  }, [open, project])

  const filename = `${slugify(project.testimony.titles[0]?.text ?? 'testimony')}.html`
  const download = () => downloadText(filename, html, 'text/html')
  const print = () => frameRef.current?.contentWindow?.print()

  const namedNarrators = pub?.testimony.narrators.filter((n) => !n.aliased).length ?? 0
  const aliasedNarrators = pub?.testimony.narrators.filter((n) => n.aliased).length ?? 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content ticks" style={{ width: 'min(1040px, calc(100vw - 32px))' }}>
          <Dialog.Title className="dialog-title">Publish testimony</Dialog.Title>
          <Dialog.Description className="dialog-desc">
            Everything below passed through the consent boundary. Restricted and
            embargoed statements, statements under a restricting sovereignty label,
            protected identities, unsafe coordinates, a non-public model, and the
            recording media do not cross it.
          </Dialog.Description>

          {busy && <div className="empty">Building consent-cleared artifact...</div>}

          {pub && !busy && (
            <div className="publish-grid">
              <div className="publish-side">
                <span className="label">What publishes</span>
                <dl className="kv" style={{ marginTop: 8 }}>
                  <dt>Statements</dt>
                  <dd className="mono">{pub.statements.length} of {project.statements.length}</dd>
                  <dt>Narrators</dt>
                  <dd className="mono">{namedNarrators} named, {aliasedNarrators} aliased</dd>
                  <dt>Model</dt>
                  <dd className="mono">{pub.testimony.model ? 'cited' : project.testimony.model ? 'withheld' : 'none'}</dd>
                  <dt>Recording</dt>
                  <dd className="mono">{pub.testimony.recording ? 'cited by hash' : 'none'}</dd>
                </dl>

                <div className="divider" />
                <span className="label">Consent boundary removed</span>
                <ul className="redaction-list">
                  {redactionLines(pub.redactions).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>

                <div className="divider" />
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={download}>
                    Download .html
                  </button>
                  <button className="btn" onClick={print}>
                    Print dossier
                  </button>
                </div>
                <p className="faint" style={{ fontSize: 11, marginTop: 10 }}>
                  One self-contained file: narrators, transcript, ground anchors,
                  the model and recording cited by hash, chronology, and the
                  disclosure. Hosts anywhere or opens offline.
                </p>
              </div>

              <div className="publish-preview ticks">
                <div className="label" style={{ padding: '6px 8px' }}>Preview = artifact</div>
                <iframe
                  ref={frameRef}
                  title="Published testimony preview"
                  className="publish-frame"
                  sandbox="allow-scripts allow-modals"
                  srcDoc={html}
                />
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <button className="dialog-close" aria-label="Close">&times;</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
