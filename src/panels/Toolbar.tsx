import { useRef, useState } from 'react'
import {
  APP_NAME,
  SUITE_NAME,
  buildProjectFile,
  formatLatLng,
  importProjectFile,
  isProjectFile,
} from '../core'
import { useStore, type StageView } from '../state/store'
import { downloadJson, readFileText, slugify } from '../lib/download'
import { PublishDialog } from '../publish/PublishDialog'
import { AboutDialog } from './AboutDialog'

const VIEWS: { value: StageView; label: string }[] = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'model', label: 'Model' },
  { value: 'map', label: 'Map' },
]

export function Toolbar() {
  const project = useStore((s) => s.project)
  const view = useStore((s) => s.view)
  const cursor = useStore((s) => s.cursor)
  const adoptProject = useStore((s) => s.adoptProject)
  const resetToSample = useStore((s) => s.resetToSample)

  const [publishOpen, setPublishOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement | null>(null)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3000)
  }

  const exportJson = async () => {
    const file = await buildProjectFile(project, new Date().toISOString())
    downloadJson(`${slugify(project.testimony.titles[0]?.text ?? 'testimony')}.testimony.json`, file)
    flash('Project file saved.')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await readFileText(file))
      if (!isProjectFile(parsed)) throw new Error('Not a Situated Testimony project file.')
      const loaded = await importProjectFile(parsed)
      adoptProject(loaded)
      flash('Project imported.')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  const reset = () => {
    if (
      window.confirm(
        'Replace the current testimony with the fictional sample? This clears your local data.',
      )
    ) {
      void resetToSample()
    }
  }

  const publicCount = project.statements.filter((s) => s.consent === 'public').length

  return (
    <div className="topbar">
      <span className="wordmark">
        <span className="suite">{SUITE_NAME}</span>
        <span className="sep">//</span>
        {APP_NAME}
      </span>

      <div className="seg" role="group" aria-label="stage view">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={view === v.value}
            onClick={() => useStore.getState().setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="btn-row">
        <button className="btn btn-sm btn-mono btn-primary" onClick={() => setPublishOpen(true)}>
          Publish
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={exportJson}>
          Export
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={() => importInput.current?.click()}>
          Import
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={reset}>
          Reset
        </button>
        <button className="btn btn-sm btn-mono btn-ghost" onClick={() => setAboutOpen(true)}>
          About
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </div>

      <div className="topbar-spacer" />

      <div className="readout">
        {msg && <span className="signal">{msg}</span>}
        <span><b>{project.statements.length}</b> statements</span>
        <span><b>{publicCount}</b> public</span>
        <span><b>{project.testimony.narrators.length}</b> narrators</span>
        <span className="cursor-readout">
          {cursor ? formatLatLng(cursor.lat, cursor.lng) : '--'}
        </span>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}
