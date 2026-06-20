import { useEffect, useRef } from 'react'
import { hasRestrictingLabel, type Statement } from '../core'
import { useStore } from '../state/store'
import {
  activeStatementId,
  narratorOf,
  statementText,
} from '../lib/derive'
import { CertaintyBadge, ConsentBadge, Dir } from '../components/ui'

function fmtClock(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return ''
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The transcript: the account as a readable, time-coded column, the spine of the
 * tool. The statement under the playhead is highlighted and scrolled into view;
 * selecting one drives the model, the map, and the chronology, and cues the
 * recording. This is the reading surface.
 */
export function Transcript() {
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const hoveredId = useStore((s) => s.hoveredId)
  const playheadSec = useStore((s) => s.playheadSec)
  const playing = useStore((s) => s.playing)

  const activeId = activeStatementId(project, playheadSec)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Follow the playhead while playing.
  useEffect(() => {
    if (!playing || !activeId) return
    const el = rowRefs.current.get(activeId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeId, playing])

  if (project.statements.length === 0) {
    return (
      <div className="transcript-wrap">
        <div className="empty">
          No statements yet. Add a statement from the rail, give it words, a clip in
          the recording, and an anchor in the model or on the map.
        </div>
      </div>
    )
  }

  return (
    <div className="transcript-wrap scroll-y">
      <div className="transcript">
        {project.statements.map((st) => (
          <StatementBlock
            key={st.id}
            statement={st}
            narratorName={narratorOf(project, st)?.name?.trim() || 'Unnamed narrator'}
            selected={st.id === selectedStatementId}
            active={st.id === activeId}
            hovered={st.id === hoveredId}
            registerRef={(el) => {
              if (el) rowRefs.current.set(st.id, el)
              else rowRefs.current.delete(st.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function StatementBlock({
  statement,
  narratorName,
  selected,
  active,
  hovered,
  registerRef,
}: {
  statement: Statement
  narratorName: string
  selected: boolean
  active: boolean
  hovered: boolean
  registerRef: (el: HTMLDivElement | null) => void
}) {
  const restricting = hasRestrictingLabel(statement.sovereignty)
  const text = statementText(statement)
  return (
    <div
      ref={registerRef}
      className="ts-block"
      data-selected={selected}
      data-active={active}
      data-hovered={hovered}
      onClick={() => useStore.getState().selectStatement(statement.id)}
      onMouseEnter={() => useStore.getState().hover(statement.id)}
      onMouseLeave={() => useStore.getState().hover(null)}
    >
      <div className="ts-gutter mono">
        {statement.clip ? (
          <span className="ts-time">{fmtClock(statement.clip.startSec)}</span>
        ) : (
          <span className="ts-time faint">--:--</span>
        )}
      </div>
      <div className="ts-body">
        <div className="ts-meta">
          <span className="ts-narrator">{narratorName}</span>
          <ConsentBadge consent={statement.consent} />
          <CertaintyBadge certainty={statement.certainty} />
          {statement.anchor?.model && <span className="ts-anchor" title="anchored in the model">model</span>}
          {statement.anchor?.geo && <span className="ts-anchor" title="anchored on the map">map</span>}
          {restricting && <span className="badge badge-embargoed" title="a sovereignty label withholds this from publication">label</span>}
        </div>
        <p className="ts-text">
          {text ? <Dir text={text} /> : <span className="faint">Empty statement.</span>}
        </p>
      </div>
    </div>
  )
}
