/**
 * Derived state: computed from the project, never stored as truth. The
 * transcript, the model, the map, the timeline, and the published artifact all
 * read from here so they agree.
 */

import {
  timeInterval,
  type Consent,
  type GeoPoint,
  type ModelAnchor,
  type Narrator,
  type Project,
  type PublicProject,
  type Statement,
} from '../core'

/** The plain text of a statement: its first line, for labels and rows. */
export function statementText(st: Statement): string {
  return st.text[0]?.text ?? ''
}

export function statementSnippet(st: Statement, max = 80): string {
  const t = statementText(st).trim()
  if (t.length <= max) return t || 'Untitled statement'
  return t.slice(0, max - 1).trimEnd() + '…'
}

export function narratorById(project: Project, id: string | undefined): Narrator | undefined {
  if (!id) return undefined
  return project.testimony.narrators.find((n) => n.id === id)
}

/** The narrator a statement belongs to, falling back to the first narrator. */
export function narratorOf(project: Project, st: Statement): Narrator | undefined {
  return narratorById(project, st.narratorId) ?? project.testimony.narrators[0]
}

export function statementsOf(project: Project, narratorId: string): Statement[] {
  return project.statements.filter((s) => s.narratorId === narratorId)
}

export interface TimelineItem {
  id: string
  label: string
  start: number
  end: number
  consent: Consent
}

/** Timeline items from statements that refer to a real-world time. */
export function timelineItems(project: Project): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const st of project.statements) {
    if (!st.refersTo) continue
    const iv = timeInterval(st.refersTo.value, st.refersTo.precision)
    if (!iv) continue
    items.push({
      id: st.id,
      label: statementSnippet(st, 60),
      start: iv.start,
      end: iv.end,
      consent: st.consent,
    })
  }
  return items.sort((a, b) => a.start - b.start)
}

/** Overall time extent across the testimony window and every dated statement. */
export function timeExtent(project: Project): [number, number] | null {
  const points: number[] = []
  const w = project.testimony.window
  if (w.start) {
    const t = Date.parse(w.start)
    if (!Number.isNaN(t)) points.push(t)
  }
  if (w.end) {
    const t = Date.parse(w.end)
    if (!Number.isNaN(t)) points.push(t)
  }
  for (const it of timelineItems(project)) points.push(it.start, it.end)
  if (points.length === 0) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  if (min === max) return [min - 86_400_000, max + 86_400_000]
  return [min, max]
}

/** Every tag in use, sorted, for the rail facets. */
export function allTags(project: Project): string[] {
  const set = new Set<string>()
  for (const st of project.statements) for (const t of st.tags) set.add(t)
  for (const t of project.testimony.tags) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
}

export interface GeoAnchor {
  statementId: string
  point: GeoPoint
}

/** Statements that carry a map anchor. */
export function geoAnchors(project: Project): GeoAnchor[] {
  const out: GeoAnchor[] = []
  for (const st of project.statements) {
    if (st.anchor?.geo) out.push({ statementId: st.id, point: st.anchor.geo })
  }
  return out
}

export interface ModelMark {
  statementId: string
  point: ModelAnchor
}

/** Statements that carry a 3D model anchor. */
export function modelAnchors(project: Project): ModelMark[] {
  const out: ModelMark[] = []
  for (const st of project.statements) {
    if (st.anchor?.model) out.push({ statementId: st.id, point: st.anchor.model })
  }
  return out
}

/** The total length of the recording, in seconds (for the transport). */
export function recordingDuration(project: Project): number {
  const r = project.testimony.recording
  const fromMeta = r?.durationSec ?? r?.file?.durationSec
  if (fromMeta && Number.isFinite(fromMeta)) return fromMeta
  // Fall back to the furthest clip end, so a transcript-only account still scrubs.
  let max = 0
  for (const st of project.statements) {
    const end = st.clip?.endSec ?? st.clip?.startSec
    if (end && end > max) max = end
  }
  return max
}

/**
 * The statement under the playhead: the one whose clip contains it, preferring
 * the latest-starting match so adjacent clips resolve to the current one.
 */
export function activeStatementId(project: Project, playheadSec: number): string | null {
  let best: { id: string; start: number } | null = null
  for (const st of project.statements) {
    if (!st.clip) continue
    const start = st.clip.startSec
    const end = st.clip.endSec ?? start
    if (playheadSec >= start && playheadSec <= Math.max(end, start)) {
      if (!best || start >= best.start) best = { id: st.id, start }
    }
  }
  return best?.id ?? null
}

/** Whether there are any drawable coordinates at all. */
export function hasGeo(p: Project | PublicProject): boolean {
  if (p.testimony.place) return true
  return p.statements.some((s) => s.anchor?.geo)
}
