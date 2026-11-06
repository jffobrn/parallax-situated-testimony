import { useRef, useState, type ReactNode } from 'react'
import { formatDateTimeShort, hasRestrictingLabel, type Narrator, type Statement } from '../core'
import { useStore } from '../state/store'
import { publishState } from '../lib/review'
import { allTags, narratorOf, statementSnippet } from '../lib/derive'
import { readFileText } from '../lib/download'
import { ConsentBadge, Dir, Menu, SelectMenu, roleLabel, rowButton } from '../components/ui'

type ConsentFilter = 'all' | 'public' | 'protected'

/** The narrator filter's value for no filter (Radix Select needs a non-empty value). */
const ALL = '__all'

const SUBJECT_WORD: Record<string, string> = {
  event: 'Testimony of an event',
  place: 'Testimony of a place',
  work: 'Testimony of a work',
  life: 'Testimony of a life',
  practice: 'Testimony of a practice',
}

function fmtClock(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return ''
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A collapsible group in the case outline. */
function Group({ title, count, children }: { title: string; count?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="group">
      <button type="button" className="group-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="twisty" aria-hidden="true" />
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </button>
      {open && children}
    </section>
  )
}

/** Whether a statement stays out of anything published. */
function isWithheld(st: Statement): boolean {
  return !publishState(st).publishes
}

/**
 * The rail: the testimony as an outline. The testimony identity at the top,
 * then the narrators, then the statements, filtered by consent, narrator, and
 * tag. Selecting anything here drives every other surface.
 */
export function Rail() {
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const selectedNarratorId = useStore((s) => s.selectedNarratorId)
  const hoveredId = useStore((s) => s.hoveredId)
  const notify = useStore((s) => s.notify)

  const [consentFilter, setConsentFilter] = useState<ConsentFilter>('all')
  const [narratorFilter, setNarratorFilter] = useState<string>('')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const transcriptInput = useRef<HTMLInputElement | null>(null)

  const onTranscriptFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await readFileText(file)
      const n = useStore.getState().importTranscript(text)
      notify(n > 0 ? `Imported ${n} statement${n === 1 ? '' : 's'}.` : 'No cues found in that file.')
    } catch {
      notify('Could not read that transcript file.')
    }
  }

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

  const narratorKnown = !narratorFilter || t.narrators.some((n) => n.id === narratorFilter)
  const statements = project.statements.filter((st) => {
    if (consentFilter === 'public' && isWithheld(st)) return false
    if (consentFilter === 'protected' && !isWithheld(st)) return false
    if (narratorFilter && narratorKnown && st.narratorId !== narratorFilter) return false
    if (activeTags.size && !st.tags.some((x) => activeTags.has(x))) return false
    return true
  })
  const filtered = statements.length !== project.statements.length

  const narratorOptions = [
    { value: ALL, label: 'All narrators' },
    ...t.narrators.map((n) => ({ value: n.id, label: n.name?.trim() || 'Unnamed narrator' })),
  ]

  return (
    <>
      <div className="pane-head">
        <span>Testimony</span>
        <Menu
          label="Add"
          entries={[
            { label: 'Narrator', onSelect: () => useStore.getState().addNarrator() },
            { label: 'Statement', onSelect: () => useStore.getState().addStatement() },
            {
              label: 'Statements from a transcript',
              hint: 'SRT, VTT, text',
              onSelect: () => transcriptInput.current?.click(),
            },
          ]}
        />
        <input
          ref={transcriptInput}
          type="file"
          accept=".srt,.vtt,.txt,text/plain,text/vtt,application/x-subrip"
          style={{ display: 'none' }}
          onChange={(e) => {
            void onTranscriptFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <Group title="Account">
        <button
          className="testimony-card"
          data-active={home}
          onClick={() => {
            useStore.getState().selectStatement(null)
            useStore.getState().selectNarrator(null)
          }}
        >
          <div className="testimony-titles">
            {t.titles.map((tt, i) => (
              <div key={i} className={i === 0 ? 'testimony-title' : 'testimony-title-alt'}>
                <Dir text={tt.text || 'Untitled'} />
              </div>
            ))}
          </div>
          <div className="row-sub wrap">
            {SUBJECT_WORD[t.subject] ?? 'Testimony'},{' '}
            {t.window.start
              ? `${formatDateTimeShort(t.window.start, t.window.precision)}${
                  t.window.end ? ` to ${formatDateTimeShort(t.window.end, t.window.precision)}` : ''
                }`
              : 'no time window yet'}
          </div>
        </button>
      </Group>

      <Group title="Narrators" count={t.narrators.length}>
        {t.narrators.length === 0 ? (
          <div className="empty">No narrators yet. Add one from the Add menu.</div>
        ) : (
          <table className="outline">
            <colgroup>
              <col />
              <col className="c-role" />
              <col className="c-consent" />
              <col className="c-said" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Identity</th>
                <th>Statements</th>
              </tr>
            </thead>
            <tbody>
              {t.narrators.map((n) => (
                <NarratorRow
                  key={n.id}
                  narrator={n}
                  count={project.statements.filter((s) => s.narratorId === n.id).length}
                  selected={n.id === selectedNarratorId}
                />
              ))}
            </tbody>
          </table>
        )}
      </Group>

      <Group
        title="Statements"
        count={filtered ? `${statements.length} of ${project.statements.length}` : project.statements.length}
      >
        {project.statements.length > 0 && (
          <div className="rail-filters">
            <div className="seg" role="group" aria-label="Filter by publication">
              {(
                [
                  ['all', 'All'],
                  ['public', 'Public'],
                  ['protected', 'Withheld'],
                ] as [ConsentFilter, string][]
              ).map(([c, label]) => (
                <button key={c} type="button" aria-pressed={consentFilter === c} onClick={() => setConsentFilter(c)}>
                  {label}
                </button>
              ))}
            </div>
            {t.narrators.length > 1 && (
              <div className="rail-filter-select">
                <SelectMenu
                  value={narratorKnown && narratorFilter ? narratorFilter : ALL}
                  options={narratorOptions}
                  onChange={(v) => setNarratorFilter(v === ALL ? '' : v)}
                  ariaLabel="Filter by narrator"
                />
              </div>
            )}
            {tags.length > 0 && (
              <div className="tag-filters" role="group" aria-label="Filter by tag">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="facet"
                    aria-pressed={activeTags.has(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {project.statements.length === 0 ? (
          <div className="empty">No statements yet. Add one, or import a transcript, from the Add menu.</div>
        ) : statements.length === 0 ? (
          <div className="empty">No statements match these filters.</div>
        ) : (
          <table className="outline">
            <colgroup>
              <col />
              <col className="c-narrator" />
              <col className="c-clip" />
              <col className="c-consent" />
            </colgroup>
            <thead>
              <tr>
                <th>Statement</th>
                <th>Narrator</th>
                <th>Clip</th>
                <th>Publishes</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((st) => (
                <StatementRow
                  key={st.id}
                  statement={st}
                  narrator={narratorOf(project, st)}
                  selected={st.id === selectedStatementId}
                  hovered={st.id === hoveredId && st.id !== selectedStatementId}
                />
              ))}
            </tbody>
          </table>
        )}
      </Group>
    </>
  )
}

function NarratorRow({ narrator, count, selected }: { narrator: Narrator; count: number; selected: boolean }) {
  const name = narrator.name?.trim() || 'Unnamed narrator'
  return (
    <tr
      className="row"
      data-selected={selected}
      data-withheld={narrator.identityConsent !== 'public'}
      {...rowButton(() => useStore.getState().selectNarrator(narrator.id))}
      title={
        narrator.identityConsent === 'public'
          ? `${name}, ${roleLabel(narrator.role).toLowerCase()}`
          : `${name}, ${roleLabel(narrator.role).toLowerCase()}; published under an alias`
      }
    >
      <td className="row-title">
        <Dir text={name} />
      </td>
      <td>{roleLabel(narrator.role)}</td>
      <td>
        <ConsentBadge consent={narrator.identityConsent} />
      </td>
      <td className="mono">{count}</td>
    </tr>
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
  const anchors = [statement.anchor?.model && 'in the model', statement.anchor?.geo && 'on the map'].filter(Boolean)
  const when = statement.refersTo
    ? `, refers to ${formatDateTimeShort(statement.refersTo.value, statement.refersTo.precision)}`
    : ''
  const title = `${statementSnippet(statement, 160)}${anchors.length ? `. Anchored ${anchors.join(' and ')}` : ''}${when}${
    restricting ? '. A sovereignty label withholds it from publication.' : ''
  }`
  return (
    <tr
      className="row"
      data-selected={selected}
      data-hovered={hovered}
      data-withheld={isWithheld(statement)}
      {...rowButton(() => useStore.getState().selectStatement(statement.id))}
      onMouseEnter={() => useStore.getState().hover(statement.id)}
      onMouseLeave={() => useStore.getState().hover(null)}
      title={title}
    >
      <td className="row-title">
        <Dir text={statementSnippet(statement, 96)} />
      </td>
      <td className="row-title">{narrator ? narrator.name?.trim() || 'Unnamed' : <span className="faint">None</span>}</td>
      <td className="mono">{fmtClock(statement.clip?.startSec)}</td>
      <td>
        {(() => {
          const ps = publishState(statement)
          return ps.publishes ? 'Yes' : <span className="badge badge-restricted">{ps.word}</span>
        })()}
      </td>
    </tr>
  )
}
