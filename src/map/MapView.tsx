import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Layer } from '@deck.gl/core'
import { useStore } from '../state/store'
import { activeStatementId } from '../lib/derive'
import { buildMapLayers } from './layers'
import {
  graticuleLines,
  makeBasemapStyle,
  registerPmtilesProtocol,
  type Bounds,
} from './basemap'

/**
 * The map view: the testimony place and each statement's ground anchor. Reuses
 * the suite map core (a synthetic graticule that fetches no tiles, so the area of
 * interest never leaks; real tiles, when wanted, come from a bundled PMTiles
 * archive). Selecting an anchor selects its statement everywhere.
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const loadedRef = useRef(false)

  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const hoveredId = useStore((s) => s.hoveredId)
  const playheadSec = useStore((s) => s.playheadSec)
  const placing = useStore((s) => s.placing)

  const activeId = activeStatementId(project, playheadSec)

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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBasemapStyle(),
      center,
      zoom: 16.2,
      attributionControl: false,
      dragRotate: false,
      maxPitch: 0,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

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

  useEffect(() => {
    rebuild()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedStatementId, hoveredId, activeId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = placing && placing.kind !== 'statement-model' ? 'crosshair' : ''
  }, [placing])

  return (
    <>
      <div className="map-fill" ref={containerRef} />
      <MapPlacementBanner />
      <div className="map-legend mono">
        <div className="legend-row"><span className="sw sw-subject" /> statement anchor</div>
        <div className="legend-row"><span className="sw sw-place" /> testimony place</div>
        <div className="legend-row"><span className="sw sw-unsafe" /> protected</div>
      </div>
    </>
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
