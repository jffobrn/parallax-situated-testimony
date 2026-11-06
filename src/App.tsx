import { lazy, Suspense, useEffect } from 'react'
import { useStore } from './state/store'
import { Toolbar } from './panels/Toolbar'
import { Rail } from './panels/Rail'
import { Inspector } from './panels/Inspector'
import { StatusBar } from './panels/StatusBar'
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
    <div className="timeline-head" role="tablist" aria-label="dock view">
      <button type="button" role="tab" className="dock-tab" aria-selected="true">
        Chronology
      </button>
      <div className="topbar-spacer" />
      <span className="dock-info">
        {extent ? (
          <>
            <span className="mono">{fmtMs(extent[0])}</span> to <span className="mono">{fmtMs(extent[1])}</span> UTC,{' '}
            {timeBrush ? (
              <button className="btn-link" onClick={() => setTimeBrush(null)}>
                clear the filter
              </button>
            ) : (
              'drag to filter'
            )}
          </>
        ) : (
          'The times the statements refer to'
        )}
      </span>
    </div>
  )
}

function Stage() {
  const view = useStore((s) => s.view)
  return (
    <div className="stage-view">
      {view === 'transcript' && <Transcript />}
      {(view === 'model' || view === 'map') && (
        <Suspense fallback={<div className="empty">Loading the view...</div>}>
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
        <div className="boot-mark">Parallax Situated Testimony</div>
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
      <div className="stage">
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
      <StatusBar />
    </div>
  )
}
