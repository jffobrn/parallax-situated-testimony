import { formatLatLng, hasRestrictingLabel } from '../core'
import { useStore } from '../state/store'
import { recordingDuration } from '../lib/derive'
import { Count } from '../components/ui'

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The status bar: where the cursor is on the map (or where the playhead is in
 * the recording), and what the testimony holds, including how many statements
 * are withheld from publication and how many narrators publish under an alias.
 * Outcome messages (saved, imported, reset) appear here too.
 */
export function StatusBar() {
  const project = useStore((s) => s.project)
  const view = useStore((s) => s.view)
  const cursor = useStore((s) => s.cursor)
  const playheadSec = useStore((s) => s.playheadSec)
  const notice = useStore((s) => s.notice)

  const statements = project.statements
  const publicCount = statements.filter((s) => s.consent === 'public' && !hasRestrictingLabel(s.sovereignty)).length
  const withheld = statements.length - publicCount
  const aliased = project.testimony.narrators.filter((n) => n.identityConsent !== 'public').length
  const duration = recordingDuration(project)

  return (
    <footer className="statusbar readout" aria-live="polite">
      <span className="status-cursor">
        {view === 'map' ? (
          cursor ? (
            <span className="mono">{formatLatLng(cursor.lat, cursor.lng)}</span>
          ) : (
            'Move over the map for coordinates'
          )
        ) : duration > 0 ? (
          <>
            Playhead <span className="mono">{fmtClock(playheadSec)}</span> of{' '}
            <span className="mono">{fmtClock(duration)}</span>
          </>
        ) : (
          'No recording or clips yet'
        )}
      </span>
      <span className="status-right">
        {notice && <span className="status-notice">{notice}</span>}
        <span>
          <Count n={statements.length} noun="statement" />, <b>{publicCount}</b> public
        </span>
        <span>
          <Count n={project.testimony.narrators.length} noun="narrator" />
          {aliased > 0 ? `, ${aliased} under an alias` : ''}
        </span>
        {withheld > 0 && <span className="alert">{withheld} withheld from publication</span>}
      </span>
    </footer>
  )
}
