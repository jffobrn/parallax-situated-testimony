import { lazy, Suspense, useEffect } from 'react'
import { useStore } from './state/store'
import { Toolbar } from './panels/Toolbar'
import { Rail } from './panels/Rail'
import { Inspector } from './panels/Inspector'
import { Transcript } from './transcript/Transcript'
import { Player } from './player/Player'
import { Timeline } from './timeline/Timeline'
import { timeExtent } from './lib/derive'

// The Model (three.js) and Map (deck.gl / MapLibre) views are heavy and secondary
// to the transcript spine, so they load on demand and stay out of the first paint.
const ModelView = lazy(() => import('./model/ModelView').then((m) => ({ default: m.ModelView })))
const MapView = lazy(() => import('./map/MapView').then((m) => ({ default: m.MapView })))

function fmtMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

function TimelineHead() {
  const project = useStore((s) => s.project)
  const timeBrush = useStore((s) => s.timeBrush)
  const setTimeBrush = useStore((s) => s.setTimeBrush)
  const extent = timeExtent(project)

  return (
    <div className="timeline-head">
      <span className="label"><span className="label-num">05</span>Chronology</span>
      {extent && (
        <span className="faint mono" style={{ fontSize: 11 }}>
          {fmtMs(extent[0])} to {fmtMs(extent[1])}
        </span>
      )}
      <div className="topbar-spacer" />
      {timeBrush ? (
        <button className="btn btn-sm btn-ghost" onClick={() => setTimeBrush(null)}>
          Clear filter
        </button>
      ) : (
        <span className="faint" style={{ fontSize: 11 }}>drag to filter</span>
      )}
    </div>
  )
}

function Stage() {
  const view = useStore((s) => s.view)
  return (
    <div className="stage-view">
      {view === 'transcript' && <Transcript />}
      {(view === 'model' || view === 'map') && (
        <Suspense fallback={<div className="empty">Loading view...</div>}>
          {view === 'model' && <ModelView />}
          {view === 'map' && <MapView />}
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-mark mono">PARALLAX // SITUATED TESTIMONY</div>
        <div className="faint">Loading local project...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <Toolbar />
      <div className="rail">
        <Rail />
      </div>
      <div className="stage ticks">
        <Stage />
      </div>
      <div className="timeline-dock">
        <Player />
        <TimelineHead />
        <Timeline />
      </div>
      <div className="inspector">
        <Inspector />
      </div>
    </div>
  )
}
