import { useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { APP_NAME, buildProjectFile, importProjectFile, isProjectFile } from '../core'
import { useStore, type StageView } from '../state/store'
import { setThemePref, useThemePref, type ThemePref } from '../state/theme'
import { Dir, Menu, type MenuEntry } from '../components/ui'
import { downloadJson, readFileText, slugify } from '../lib/download'
import { PublishDialog } from '../publish/PublishDialog'
import { AboutDialog } from './AboutDialog'

const GUIDE_URL = 'https://github.com/jffobrn/parallax-situated-testimony/blob/main/docs/GUIDE.md'

const VIEWS: { value: StageView; label: string }[] = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'model', label: 'Model' },
  { value: 'map', label: 'Map' },
]

type Confirm = 'new' | 'reset' | null

const CONFIRM_COPY: Record<'new' | 'reset', { title: string; body: string; action: string }> = {
  new: {
    title: 'Start a new testimony?',
    body: 'The current testimony is replaced by an empty one. Save it first to keep it.',
    action: 'Start new',
  },
  reset: {
    title: 'Reset to the sample?',
    body: 'The current testimony is replaced by the fictional sample. Save it first to keep it.',
    action: 'Reset to the sample',
  },
}

/** The id of the tool bar slot a stage view fills with its own tools. */
export const MAP_TOOLS_SLOT = 'map-tools-slot'

const ICONS: Record<string, ReactNode> = {
  select: <path d="M5 3l10 6-4.5 1.2L13 15l-1.8.8-2.4-4.6L5 14z" />,
  model: (
    <>
      <path d="M10 2.5l6.5 3.6v7.8L10 17.5l-6.5-3.6V6.1z" fill="none" />
      <path d="M3.5 6.1L10 9.7l6.5-3.6M10 9.7v7.8" fill="none" />
    </>
  ),
  anchor: (
    <>
      <path d="M10 17s-5-5.2-5-9a5 5 0 0110 0c0 3.8-5 9-5 9z" fill="none" />
      <circle cx="10" cy="8" r="1.6" />
    </>
  ),
  place: (
    <>
      <circle cx="10" cy="10" r="5.5" fill="none" />
      <circle cx="10" cy="10" r="1.8" />
    </>
  ),
  measure: (
    <>
      <path d="M3 14L14 3l3 3L6 17z" fill="none" />
      <path d="M7 10l1.5 1.5M9.5 7.5L11 9M12 5l1.5 1.5" fill="none" />
    </>
  ),
  ground: <path d="M3 6l7-3 7 3-7 3zM3 10l7 3 7-3M3 14l7 3 7-3" fill="none" />,
  camera: (
    <>
      <path d="M3 6.5h3l1.5-2h5L14 6.5h3v9H3z" fill="none" />
      <circle cx="10" cy="11" r="2.8" fill="none" />
    </>
  ),
}

/** A plain line icon for a tool, drawn in the current text colour. */
export function ToolIcon({ name }: { name: keyof typeof ICONS | string }) {
  return (
    <svg className="ic" viewBox="0 0 20 20" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function Toolbar() {
  const project = useStore((s) => s.project)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const adoptProject = useStore((s) => s.adoptProject)
  const resetToSample = useStore((s) => s.resetToSample)
  const newBlankProject = useStore((s) => s.newBlankProject)
  const notify = useStore((s) => s.notify)
  const placing = useStore((s) => s.placing)
  const setPlacing = useStore((s) => s.setPlacing)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const themePref = useThemePref()

  const [publishOpen, setPublishOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const importInput = useRef<HTMLInputElement | null>(null)

  const exportJson = async () => {
    const file = await buildProjectFile(project, new Date().toISOString())
    downloadJson(`${slugify(project.testimony.titles[0]?.text ?? 'testimony')}.testimony.json`, file)
    notify('Project file saved.')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await readFileText(file))
      if (!isProjectFile(parsed)) throw new Error('Not a Situated Testimony project file.')
      const loaded = await importProjectFile(parsed)
      adoptProject(loaded)
      notify('Project imported.')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  // New and Reset both discard the current project, so each asks to confirm in
  // an in-app dialog (window.confirm is suppressed by some browsers and
  // installed PWAs), and the outcome is reported either way.
  const runConfirmed = () => {
    const kind = confirm
    setConfirm(null)
    if (!kind) return
    const run = kind === 'new' ? newBlankProject : resetToSample
    run()
      .then(() => notify(kind === 'new' ? 'New blank testimony.' : 'Reset to the sample.'))
      .catch((e) => notify(e instanceof Error ? e.message : 'Action failed.'))
  }

  const theme = (pref: ThemePref, label: string): MenuEntry => ({
    label,
    checked: themePref === pref,
    onSelect: () => setThemePref(pref),
  })

  const caseEntries: MenuEntry[] = [
    { label: 'New testimony', onSelect: () => setConfirm('new') },
    { label: 'Open project file', onSelect: () => importInput.current?.click() },
    { label: 'Save project file', onSelect: () => void exportJson() },
    { separator: true, label: '' },
    { label: 'Reset to the sample', danger: true, onSelect: () => setConfirm('reset') },
  ]
  const viewEntries: MenuEntry[] = [
    { heading: true, label: 'Stage' },
    ...VIEWS.map((v) => ({ label: v.label, checked: view === v.value, onSelect: () => setView(v.value) })),
    { separator: true, label: '' },
    { heading: true, label: 'Appearance' },
    theme('system', 'Match the system'),
    theme('light', 'Light'),
    theme('dark', 'Dark'),
  ]
  const helpEntries: MenuEntry[] = [
    { label: `About ${APP_NAME}`, onSelect: () => setAboutOpen(true) },
    { label: "Researcher's guide", hint: 'opens online', onSelect: () => window.open(GUIDE_URL, '_blank', 'noopener') },
  ]

  const caseTitle = project.testimony.titles[0]?.text
  const selected = project.statements.find((s) => s.id === selectedStatementId)
  const needStatement = selected ? undefined : 'Select a statement first'

  const placeIn = (kind: 'statement-model' | 'statement-geo') => {
    if (!selected) return
    setView(kind === 'statement-model' ? 'model' : 'map')
    setPlacing({ kind, statementId: selected.id })
  }

  return (
    <>
      <div className="topbar">
        <span className="wordmark">{APP_NAME}</span>
        <nav className="menus" aria-label="Menus">
          <Menu label="Case" entries={caseEntries} align="left" />
          <Menu label="View" entries={viewEntries} align="left" />
          <Menu label="Help" entries={helpEntries} align="left" />
        </nav>
        {caseTitle && (
          <span className="case-title">
            <Dir text={caseTitle} />
          </span>
        )}
        <div className="topbar-spacer" />
        <button className="btn btn-primary" onClick={() => setPublishOpen(true)}>
          Publish
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            void onImport(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <div className="toolstrip" role="toolbar" aria-label="Tools">
        <div className="seg stage-switch" role="group" aria-label="stage view">
          {VIEWS.map((v) => (
            <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
              {v.label}
            </button>
          ))}
        </div>
        <span className="tool-sep" />
        <button className="tool" aria-pressed={!placing} onClick={() => setPlacing(null)}>
          <ToolIcon name="select" />
          Select
        </button>
        <button
          className="tool"
          aria-pressed={placing?.kind === 'statement-model'}
          disabled={!selected}
          title={needStatement ?? 'Click the model to anchor the selected statement'}
          onClick={() => placeIn('statement-model')}
        >
          <ToolIcon name="model" />
          Anchor in model
        </button>
        <button
          className="tool"
          aria-pressed={placing?.kind === 'statement-geo'}
          disabled={!selected}
          title={needStatement ?? 'Click the map to anchor the selected statement'}
          onClick={() => placeIn('statement-geo')}
        >
          <ToolIcon name="anchor" />
          Anchor on map
        </button>
        <button
          className="tool"
          aria-pressed={placing?.kind === 'testimony-place'}
          title="Click the map to place the testimony"
          onClick={() => {
            setView('map')
            setPlacing({ kind: 'testimony-place' })
          }}
        >
          <ToolIcon name="place" />
          Place testimony
        </button>
        <span className="tool-sep" />
        <div id={MAP_TOOLS_SLOT} className="tool-slot" />
      </div>

      <Dialog.Root open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content" style={{ width: 'min(460px, calc(100vw - 32px))' }}>
            {confirm && (
              <>
                <Dialog.Title className="dialog-title">{CONFIRM_COPY[confirm].title}</Dialog.Title>
                <Dialog.Description className="dialog-desc">{CONFIRM_COPY[confirm].body}</Dialog.Description>
                <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger btn-solid" onClick={runConfirmed}>
                    {CONFIRM_COPY[confirm].action}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  )
}
