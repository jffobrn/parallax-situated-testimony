import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from '@deck.gl/core'
import { useStore } from '../state/store'
import { activeStatementId } from '../lib/derive'
import type { Project } from '../core'
import { buildMapLayers } from './layers'
import {
  graticuleLines,
  makeBasemapStyle,
  registerBasemapFile,
  registerPmtilesProtocol,
  type BasemapSource,
  type Bounds,
} from './basemap'

const BASEMAP_KEY = 'situated-testimony.basemap'

/** Persisted default. 'file' is a per-session choice and is never persisted. */
function loadBasemapPref(): BasemapSource {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(BASEMAP_KEY) : null
  return v === 'streets' || v === 'graticule' ? v : 'satellite'
}

/** Every placed point in the project, as [lng, lat], for fitting the view. */
function collectPoints(project: Project): [number, number][] {
  const out: [number, number][] = []
  const push = (p?: { lat: number; lng: number }) => {
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) out.push([p.lng, p.lat])
  }
  push(project.testimony.place)
  for (const s of project.statements) {
    push(s.anchor?.geo)
  }
  return out
}

/**
 * The map view: the testimony place and each statement's ground anchor. Reuses
 * the suite map core. The basemap defaults to real satellite imagery (Esri,
 * tokenless); Streets (OSM), a synthetic Grid that fetches no tiles, and a local
 * PMTiles archive are the alternatives. Selecting an anchor selects its statement
 * everywhere.
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const loadedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const hoveredId = useStore((s) => s.hoveredId)
  const playheadSec = useStore((s) => s.playheadSec)
  const placing = useStore((s) => s.placing)

  const activeId = activeStatementId(project, playheadSec)
  const [basemap, setBasemap] = useState<BasemapSource>(loadBasemapPref)

  const dataRef = useRef({ project, selectedStatementId, hoveredId, activeId })
  dataRef.current = { project, selectedStatementId, hoveredId, activeId }

  const buildLayers = (): Layer[] => {
    const map = mapRef.current
    if (!map) return []
    const b = map.getBounds()
    const bounds: Bounds = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    }
    const d = dataRef.current
    return buildMapLayers({
      project: d.project,
      selectedStatementId: d.selectedStatementId,
      hoveredId: d.hoveredId,
      activeId: d.activeId,
      graticule: graticuleLines(bounds),
      onPickStatement: (id) => useStore.getState().selectStatement(id),
    })
  }

  const rebuild = () => {
    if (!loadedRef.current || !overlayRef.current) return
    overlayRef.current.setProps({ layers: buildLayers() })
  }

  useEffect(() => {
    if (!containerRef.current) return
    registerPmtilesProtocol()

    const s = useStore.getState().project
    const anchor =
      s.testimony.place ?? s.statements.find((x) => x.anchor?.geo)?.anchor?.geo
    const center: [number, number] = anchor ? [anchor.lng, anchor.lat] : [-19.85, 34.405]

    // 'file' cannot be restored without a re-picked file, so fall back to satellite.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBasemapStyle(basemap === 'file' ? 'satellite' : basemap),
      center,
      zoom: 16.2,
      attributionControl: false,
      dragRotate: false,
      maxPitch: 0,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] })
    overlayRef.current = overlay
    map.addControl(overlay)

    map.on('load', () => {
      loadedRef.current = true
      fitToData(map, useStore.getState().project)
      rebuild()
    })
    map.on('move', rebuild)

    map.on('click', (e) => {
      const p = useStore.getState().placing
      if (p && p.kind !== 'statement-model') {
        useStore.getState().applyGeoPlacement(e.lngLat.lat, e.lngLat.lng)
      }
    })

    let raf = 0
    let pending: { lat: number; lng: number } | null = null
    map.on('mousemove', (e) => {
      pending = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (pending) useStore.getState().setCursor(pending)
      })
    })
    map.on('mouseout', () => useStore.getState().setCursor(null))

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
      overlayRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap the basemap style; deck layers are re-added once the new style parses.
  const applyBasemap = (source: BasemapSource, fileKey?: string) => {
    const map = mapRef.current
    if (!map) return
    loadedRef.current = false
    map.setStyle(makeBasemapStyle(source, fileKey))
    map.once('styledata', () => {
      loadedRef.current = true
      rebuild()
    })
  }

  const chooseBasemap = (source: BasemapSource) => {
    if (source === 'file') {
      fileInputRef.current?.click()
      return
    }
    setBasemap(source)
    try {
      localStorage.setItem(BASEMAP_KEY, source)
    } catch {
      /* storage unavailable; the choice still applies for the session */
    }
    applyBasemap(source)
  }

  const onFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const key = await registerBasemapFile(f)
      setBasemap('file')
      applyBasemap('file', key)
    } catch {
      // Leave the current basemap in place; a bad file changes nothing.
      // eslint-disable-next-line no-console
      console.warn('Could not read that .pmtiles basemap.')
    }
  }

  useEffect(() => {
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedStatementId, hoveredId, activeId])

  // Fit the view to placed points shortly after they change, so a coordinate
  // typed into the inspector becomes visible without a reload.
  const pointsKey = useMemo(
    () => collectPoints(project).map((p) => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join('|'),
    [project],
  )
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const pts = collectPoints(project)
    if (pts.length === 0) return
    const t = window.setTimeout(() => {
      if (pts.length === 1) {
        map.easeTo({ center: pts[0], zoom: Math.max(map.getZoom(), 15), duration: 600 })
      } else {
        const b = new maplibregl.LngLatBounds(pts[0], pts[0])
        for (const p of pts) b.extend(p)
        map.fitBounds(b, { padding: 90, maxZoom: 17, duration: 600 })
      }
    }, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = placing && placing.kind !== 'statement-model' ? 'crosshair' : ''
  }, [placing])

  return (
    <>
      <div className="map-fill" ref={containerRef} />
      <BasemapPicker active={basemap} onChoose={chooseBasemap} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pmtiles"
        style={{ display: 'none' }}
        onChange={onFilePicked}
      />
      <MapPlacementBanner />
      <div className="map-legend mono">
        <div className="legend-row"><span className="sw sw-subject" /> statement anchor</div>
        <div className="legend-row"><span className="sw sw-place" /> testimony place</div>
        <div className="legend-row"><span className="sw sw-unsafe" /> protected</div>
      </div>
    </>
  )
}

function BasemapPicker({
  active,
  onChoose,
}: {
  active: BasemapSource
  onChoose: (s: BasemapSource) => void
}) {
  const online = active === 'satellite' || active === 'streets'
  const opts: { id: BasemapSource; label: string; title: string }[] = [
    { id: 'satellite', label: 'Satellite', title: 'Esri World Imagery (tokenless)' },
    { id: 'streets', label: 'Streets', title: 'OpenStreetMap' },
    { id: 'graticule', label: 'Grid', title: 'Coordinate grid only; nothing is fetched' },
    { id: 'file', label: 'File', title: 'Load a local .pmtiles basemap; nothing is fetched' },
  ]
  return (
    <div className="basemap-picker mono">
      <div className="basemap-row">
        {opts.map((o) => (
          <button
            key={o.id}
            className="basemap-btn"
            data-active={active === o.id}
            title={o.title}
            onClick={() => onChoose(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {online && (
        <div className="basemap-note">viewport visible to the tile server while you edit</div>
      )}
    </div>
  )
}

function fitToData(map: maplibregl.Map, project: ReturnType<typeof useStore.getState>['project']) {
  const pts: [number, number][] = []
  if (project.testimony.place) pts.push([project.testimony.place.lng, project.testimony.place.lat])
  for (const st of project.statements) {
    if (st.anchor?.geo) pts.push([st.anchor.geo.lng, st.anchor.geo.lat])
  }
  if (pts.length < 2) return
  const bounds = pts.reduce(
    (b, p) => b.extend(p),
    new maplibregl.LngLatBounds(pts[0], pts[0]),
  )
  map.fitBounds(bounds, { padding: 80, maxZoom: 16.5, duration: 0 })
}

function MapPlacementBanner() {
  const placing = useStore((s) => s.placing)
  const setPlacing = useStore((s) => s.setPlacing)
  if (!placing || placing.kind === 'statement-model') return null
  const what = placing.kind === 'testimony-place' ? 'testimony place' : 'statement anchor'
  return (
    <div className="map-banner">
      <span>
        Click the map to place the <b>{what}</b>
      </span>
      <button className="btn btn-sm btn-ghost" onClick={() => setPlacing(null)}>
        Cancel
      </button>
    </div>
  )
}
