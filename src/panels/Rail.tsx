import { useState } from 'react'
import {
  formatDateTimeShort,
  hasRestrictingLabel,
  type Narrator,
  type Statement,
} from '../core'
import { useStore } from '../state/store'
import { allTags, narratorOf, statementSnippet } from '../lib/derive'
import { ConsentBadge, Dir, RoleBadge, rowButton } from '../components/ui'

type ConsentFilter = 'all' | 'public' | 'protected'

/**
 * The rail: the testimony identity at the top, then the narrators, then the
 * statements faceted by consent, narrator, and tag. Selecting anything here
 * drives every other surface.
 */
export function Rail() {
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const selectedNarratorId = useStore((s) => s.selectedNarratorId)
  const hoveredId = useStore((s) => s.hoveredId)

  const [consentFilter, setConsentFilter] = useState<ConsentFilter>('all')
  const [narratorFilter, setNarratorFilter] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const t = project.testimony
  const home = !selectedStatementId && !selectedNarratorId

  const tags = allTags(project)
  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const statements = project.statements.filter((st) => {
    if (consentFilter === 'public' && st.consent !== 'public') return false
    if (consentFilter === 'protected' && st.consent === 'public') return false
    if (narratorFilter && st.narratorId !== narratorFilter) return false
    if (activeTags.size && !st.tags.some((x) => activeTags.has(x))) return false
    return true
  })

  return (
    <>
      {/* Testimony identity / open the testimony editor */}
      <button
        className="atlas-card"
        data-active={home}
        onClick={() => {
          useStore.getState().selectStatement(null)
          useStore.getState().selectNarrator(null)
        }}
      >
        <div className="between">
          <span className="label"><span className="label-num">01</span>Testimony</span>
          <span className="tag">{t.subject}</span>
        </div>
        <div className="atlas-titles">
          {t.titles.map((tt, i) => (
            <div key={i} className={i === 0 ? 'atlas-title' : 'atlas-title-alt'}>
              <Dir text={tt.text || 'Untitled'} />
            </div>
          ))}
        </div>
        <div className="row-sub" style={{ padding: 0 }}>
          {t.window.start ? formatDateTimeShort(t.window.start, t.window.precision) : 'no window'}
          {t.window.end ? ` -> ${formatDateTimeShort(t.window.end, t.window.precision)}` : ''}
        </div>
      </button>

      {/* Narrators */}
      <div className="panel">
        <div className="panel-head">
          <span className="label"><span className="label-num">02</span>Narrators</span>
          <span className="faint mono" style={{ fontSize: 11 }}>{t.narrators.length}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => useStore.getState().addNarrator()}>
            + Narrator
          </button>
        </div>
        <div className="list">
          {t.narrators.length === 0 && <div className="empty">No narrators yet.</div>}
          {t.narrators.map((n) => (
            <NarratorRow
              key={n.id}
              narrator={n}
              count={project.statements.filter((s) => s.narratorId === n.id).length}
              selected={n.id === selectedNarratorId}
              filtered={n.id === narratorFilter}
              onFilter={() => setNarratorFilter((cur) => (cur === n.id ? null : n.id))}
            />
          ))}
        </div>
      </div>

      {/* Statements */}
      <div className="panel">
        <div className="panel-head">
          <span className="label"><span className="label-num">03</span>Statements</span>
          <span className="faint mono" style={{ fontSize: 11 }}>{statements.length}/{project.statements.length}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => useStore.getState().addStatement()}>
            + Statement
          </button>
        </div>

        <div className="facet-row">
          {(['all', 'public', 'protected'] as ConsentFilter[]).map((c) => (
            <button key={c} className="facet" data-on={consentFilter === c} onClick={() => setConsentFilter(c)}>
              {c}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="facet-row">
            {tags.map((tag) => (
              <button key={tag} className="facet" data-on={activeTags.has(tag)} onClick={() => toggleTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="list">
          {statements.length === 0 && <div className="empty">No statements match.</div>}
          {statements.map((st) => (
            <StatementRow
              key={st.id}
              statement={st}
              narrator={narratorOf(project, st)}
              selected={st.id === selectedStatementId}
              hovered={st.id === hoveredId && st.id !== selectedStatementId}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function NarratorRow({
  narrator,
  count,
  selected,
  filtered,
  onFilter,
}: {
  narrator: Narrator
  count: number
  selected: boolean
  filtered: boolean
  onFilter: () => void
}) {
  return (
    <div
      className="row"
      data-selected={selected}
      {...rowButton(() => useStore.getState().selectNarrator(narrator.id))}
    >
      <div className="row-main">
        <div className="row-title">
          <Dir text={narrator.name?.trim() || 'Unnamed narrator'} />
        </div>
        <div className="row-sub">
          <RoleBadge role={narrator.role} />
          <ConsentBadge consent={narrator.identityConsent} />
          <span>·{count}</span>
        </div>
      </div>
      <button
        className="facet"
        data-on={filtered}
        title="Filter statements to this narrator"
        onClick={(e) => {
          e.stopPropagation()
          onFilter()
        }}
      >
        filter
      </button>
    </div>
  )
}

function StatementRow({
  statement,
  narrator,
  selected,
  hovered,
}: {
  statement: Statement
  narrator: Narrator | undefined
  selected: boolean
  hovered: boolean
}) {
  const restricting = hasRestrictingLabel(statement.sovereignty)
  return (
    <div
      className="row"
      data-selected={selected}
      data-hovered={hovered}
      {...rowButton(() => useStore.getState().selectStatement(statement.id))}
      onMouseEnter={() => useStore.getState().hover(statement.id)}
      onMouseLeave={() => useStore.getState().hover(null)}
    >
      <div className="row-main">
        <div className="row-title" style={{ whiteSpace: 'normal' }}>
          <Dir text={statementSnippet(statement, 96)} />
        </div>
        <div className="row-sub">
          {narrator && <span className="faint">{narrator.name?.trim() || 'Unnamed'}</span>}
          <ConsentBadge consent={statement.consent} />
          {statement.anchor?.model && <span title="anchored in the model">M</span>}
          {statement.anchor?.geo && <span title="anchored on the map">G</span>}
          {statement.clip && <span title="cued to the recording">▶</span>}
          {restricting && <span className="alert" title="a sovereignty label withholds this from publication">⦸</span>}
          {statement.refersTo && (
            <span>{formatDateTimeShort(statement.refersTo.value, statement.refersTo.precision)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
