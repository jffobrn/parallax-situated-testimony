/**
 * Application state (Zustand). Holds the one project, the selection shared by
 * every surface (rail, transcript, model, map, timeline), the active stage view,
 * the recording transport (playhead and play state), the placement gesture for
 * the map and the model, and the time brush. Mutations persist to IndexedDB on a
 * short debounce. Media bytes never live here; only the typed records do.
 */

import { create } from 'zustand'
import {
  blankSovereignty,
  clearProject,
  loadProject,
  newId,
  pruneMedia,
  saveProject,
  type GeoPoint,
  type ModelAnchor,
  type Narrator,
  type Project,
  type Recording,
  type SceneModel,
  type Sovereignty,
  type Statement,
  type Testimony,
} from '../core'
import { buildSampleProject } from '../sample/sampleProject'

export type StageView = 'transcript' | 'model' | 'map'

/** What a placement click will set next, if anything. */
export type Placing =
  | { kind: 'testimony-place' }
  | { kind: 'statement-geo'; statementId: string }
  | { kind: 'statement-model'; statementId: string }
  | null

export interface AppState {
  project: Project
  ready: boolean

  view: StageView

  selectedStatementId: string | null
  selectedNarratorId: string | null
  hoveredId: string | null
  editingStatementId: string | null

  // recording transport
  playheadSec: number
  playing: boolean
  /** Bumped to ask the Player to seek to seekTargetSec. */
  seekVersion: number
  seekTargetSec: number

  timeBrush: { start: number; end: number } | null
  placing: Placing
  cursor: { lat: number; lng: number } | null

  // lifecycle
  init: () => Promise<void>
  resetToSample: () => Promise<void>
  adoptProject: (project: Project) => void

  // testimony identity + sovereignty
  patchTestimony: (partial: Partial<Testimony>) => void
  patchSovereignty: (partial: Partial<Sovereignty>) => void
  setRecording: (recording: Recording | undefined) => void
  setModel: (model: SceneModel | undefined) => void

  // narrators
  addNarrator: () => void
  updateNarrator: (id: string, partial: Partial<Narrator>) => void
  removeNarrator: (id: string) => void

  // statements
  addStatement: () => void
  updateStatement: (id: string, partial: Partial<Statement>) => void
  removeStatement: (id: string) => void
  moveStatement: (id: string, dir: -1 | 1) => void

  // selection / interaction
  selectStatement: (id: string | null) => void
  selectNarrator: (id: string | null) => void
  hover: (id: string | null) => void
  setEditingStatement: (id: string | null) => void
  setView: (view: StageView) => void
  setTimeBrush: (range: { start: number; end: number } | null) => void
  setCursor: (c: { lat: number; lng: number } | null) => void

  // transport
  setPlayhead: (sec: number) => void
  setPlaying: (on: boolean) => void
  seek: (sec: number) => void

  // placement
  setPlacing: (placing: Placing) => void
  applyGeoPlacement: (lat: number, lng: number) => void
  applyModelPlacement: (p: ModelAnchor) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(project: Project) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void saveProject(project)
    void pruneMedia(project)
  }, 400)
}

// Flush a pending debounced save when the tab is hidden, so an edit made in the
// last fraction of a second before the page closes is not lost. Registered once.
let flushHooked = false
function hookFlushOnHide(getProject: () => Project) {
  if (flushHooked || typeof document === 'undefined') return
  flushHooked = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
      void saveProject(getProject())
    }
  })
}

export const useStore = create<AppState>()((set, get) => {
  /** Apply a project mutation and queue a save. */
  const commit = (project: Project) => {
    set({ project })
    schedulePersist(project)
  }

  return {
    project: blankProject(),
    ready: false,

    view: 'transcript',

    selectedStatementId: null,
    selectedNarratorId: null,
    hoveredId: null,
    editingStatementId: null,

    playheadSec: 0,
    playing: false,
    seekVersion: 0,
    seekTargetSec: 0,

    timeBrush: null,
    placing: null,
    cursor: null,

    async init() {
      hookFlushOnHide(() => get().project)
      const existing = await loadProject()
      if (existing) {
        set({ project: existing, ready: true })
        return
      }
      const sample = await buildSampleProject()
      await saveProject(sample)
      set({ project: sample, ready: true })
    },

    async resetToSample() {
      await clearProject()
      const sample = await buildSampleProject()
      await saveProject(sample)
      set({
        project: sample,
        selectedStatementId: null,
        selectedNarratorId: null,
        editingStatementId: null,
        playing: false,
        playheadSec: 0,
        timeBrush: null,
        placing: null,
      })
    },

    adoptProject(project) {
      set({
        project,
        selectedStatementId: null,
        selectedNarratorId: null,
        editingStatementId: null,
        playing: false,
        playheadSec: 0,
        timeBrush: null,
        placing: null,
      })
      schedulePersist(project)
    },

    patchTestimony(partial) {
      const p = get().project
      commit({ ...p, testimony: { ...p.testimony, ...partial } })
    },

    patchSovereignty(partial) {
      const p = get().project
      commit({
        ...p,
        testimony: {
          ...p.testimony,
          sovereignty: { ...p.testimony.sovereignty, ...partial },
        },
      })
    },

    setRecording(recording) {
      const p = get().project
      commit({ ...p, testimony: { ...p.testimony, recording } })
    },

    setModel(model) {
      const p = get().project
      commit({ ...p, testimony: { ...p.testimony, model } })
    },

    addNarrator() {
      const p = get().project
      const narrator: Narrator = {
        id: newId('nar'),
        name: '',
        role: 'witness',
        identityConsent: 'restricted',
      }
      commit({
        ...p,
        testimony: { ...p.testimony, narrators: [...p.testimony.narrators, narrator] },
      })
      set({ selectedNarratorId: narrator.id, selectedStatementId: null })
    },

    updateNarrator(id, partial) {
      const p = get().project
      commit({
        ...p,
        testimony: {
          ...p.testimony,
          narrators: p.testimony.narrators.map((n) =>
            n.id === id ? { ...n, ...partial } : n,
          ),
        },
      })
    },

    removeNarrator(id) {
      const p = get().project
      commit({
        ...p,
        testimony: {
          ...p.testimony,
          narrators: p.testimony.narrators.filter((n) => n.id !== id),
        },
        statements: p.statements.map((s) =>
          s.narratorId === id ? { ...s, narratorId: undefined } : s,
        ),
      })
      if (get().selectedNarratorId === id) set({ selectedNarratorId: null })
    },

    addStatement() {
      const p = get().project
      const statement: Statement = {
        id: newId('st'),
        narratorId: p.testimony.narrators[0]?.id,
        text: [{ text: '', lang: 'en' }],
        certainty: 'probable',
        consent: 'public',
        sovereignty: blankSovereignty(),
        tags: [],
      }
      commit({ ...p, statements: [...p.statements, statement] })
      set({
        selectedStatementId: statement.id,
        selectedNarratorId: null,
        editingStatementId: statement.id,
      })
    },

    updateStatement(id, partial) {
      const p = get().project
      commit({
        ...p,
        statements: p.statements.map((s) => (s.id === id ? { ...s, ...partial } : s)),
      })
    },

    removeStatement(id) {
      const p = get().project
      commit({ ...p, statements: p.statements.filter((s) => s.id !== id) })
      if (get().selectedStatementId === id) set({ selectedStatementId: null })
      if (get().editingStatementId === id) set({ editingStatementId: null })
    },

    moveStatement(id, dir) {
      const p = get().project
      const i = p.statements.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.statements.length) return
      const next = p.statements.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      commit({ ...p, statements: next })
    },

    selectStatement(id) {
      set({ selectedStatementId: id, selectedNarratorId: null })
      // Picking a statement cues the recording to its clip, the synchronized move.
      if (id) {
        const st = get().project.statements.find((s) => s.id === id)
        if (st?.clip) get().seek(st.clip.startSec)
      }
    },
    selectNarrator(id) {
      set({ selectedNarratorId: id, selectedStatementId: null })
    },
    hover(id) {
      set({ hoveredId: id })
    },
    setEditingStatement(id) {
      set({ editingStatementId: id })
      if (id) set({ selectedStatementId: id, selectedNarratorId: null })
    },
    setView(view) {
      set({ view })
    },
    setTimeBrush(range) {
      set({ timeBrush: range })
    },
    setCursor(c) {
      set({ cursor: c })
    },

    setPlayhead(sec) {
      set({ playheadSec: Math.max(0, sec) })
    },
    setPlaying(on) {
      set({ playing: on })
    },
    seek(sec) {
      const t = Math.max(0, sec)
      set({ playheadSec: t, seekTargetSec: t, seekVersion: get().seekVersion + 1 })
    },

    setPlacing(placing) {
      set({ placing })
    },

    applyGeoPlacement(lat, lng) {
      const placing = get().placing
      if (!placing || placing.kind === 'statement-model') return
      const p = get().project
      lat = Math.round(lat * 1e6) / 1e6
      lng = Math.round(lng * 1e6) / 1e6

      if (placing.kind === 'testimony-place') {
        const prev = p.testimony.place
        commit({
          ...p,
          testimony: {
            ...p.testimony,
            place: { lat, lng, safeToPublish: prev?.safeToPublish ?? true, name: prev?.name },
          },
        })
        set({ placing: null })
        return
      }

      // statement-geo
      const st = p.statements.find((s) => s.id === placing.statementId)
      if (st) {
        const prev = st.anchor?.geo
        const geo: GeoPoint = { lat, lng, safeToPublish: prev?.safeToPublish ?? true }
        get().updateStatement(st.id, { anchor: { ...st.anchor, geo } })
      }
      set({ placing: null })
    },

    applyModelPlacement(point) {
      const placing = get().placing
      if (!placing || placing.kind !== 'statement-model') return
      const p = get().project
      const st = p.statements.find((s) => s.id === placing.statementId)
      if (st) {
        const round = (n: number) => Math.round(n * 1e4) / 1e4
        const model = { x: round(point.x), y: round(point.y), z: round(point.z) }
        get().updateStatement(st.id, { anchor: { ...st.anchor, model } })
      }
      set({ placing: null })
    },
  }
})

function blankProject(): Project {
  const narrator: Narrator = {
    id: 'nar-1',
    name: '',
    role: 'witness',
    identityConsent: 'restricted',
  }
  const testimony: Testimony = {
    id: 'testimony',
    titles: [{ text: 'Untitled testimony', lang: 'en' }],
    subject: 'event',
    narrators: [narrator],
    window: { precision: 'day' },
    sovereignty: blankSovereignty(),
    tags: [],
  }
  return { testimony, statements: [] }
}
