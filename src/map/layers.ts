/**
 * deck.gl layer construction for the map. Pure: given the project, the selection,
 * and a graticule, it returns the layer stack. Situated Testimony draws the
 * testimony place and each statement's ground anchor; selecting an anchor selects
 * its statement, and the active statement (under the playhead) is emphasized.
 */

import type { Layer } from '@deck.gl/core'
import { LineLayer, PathLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import { fromLocalEN, modelToGeo, type Project } from '../core'
import { allCameras, effectiveGeoref } from '../lib/cameras'
import type { Graticule } from './basemap'
import { mapPalette, type Ground } from './palette'

export interface BuildLayersArgs {
  project: Project
  selectedStatementId: string | null
  hoveredId: string | null
  activeId: string | null
  graticule: Graticule
  /** Whether the ground under the marks is dark (imagery) or light. */
  ground?: Ground
  onPickStatement?: (id: string) => void
  /** The imported camera in focus. */
  selectedCameraId?: string | null
  onPickCamera?: (id: string) => void
}

interface PointDatum {
  position: [number, number]
  statementId: string
  emphasized: boolean
  unsafe: boolean
}

export function buildMapLayers(args: BuildLayersArgs): Layer[] {
  const { project, selectedStatementId, hoveredId, activeId, graticule } = args
  const C = mapPalette(args.ground ?? 'dark')
  const isEmph = (id: string) => id === selectedStatementId || id === hoveredId || id === activeId

  const anchorPts: PointDatum[] = []
  for (const st of project.statements) {
    const g = st.anchor?.geo
    if (!g) continue
    anchorPts.push({
      position: [g.lng, g.lat],
      statementId: st.id,
      emphasized: isEmph(st.id),
      unsafe: !g.safeToPublish,
    })
  }

  const layers: Layer[] = []

  // The model's footprint once it is tied to the ground (the procedural
  // massing's extent; a loaded model's extent is not known here).
  const g = effectiveGeoref(project.testimony)
  const procedural = !project.testimony.model || project.testimony.model.kind === 'procedural'
  const footprint =
    g && procedural
      ? [
          [-30, -20],
          [30, -20],
          [30, 20],
          [-30, 20],
          [-30, -20],
        ].map(([x, z]) => {
          const p = modelToGeo(g, { x, z })
          return [p.lng, p.lat] as [number, number]
        })
      : null

  // Cameras brought in from Sightlines and Atlas, each with a short ray.
  const cams = allCameras(project.testimony).map(({ camera }) => {
    const b = (camera.bearingDeg * Math.PI) / 180
    // Long enough to reach a site a few hundred metres off, as photographs often are.
    const end = fromLocalEN(camera, Math.sin(b) * 320, Math.cos(b) * 320)
    return { camera, source: [camera.lng, camera.lat] as [number, number], target: [end.lng, end.lat] as [number, number] }
  })

  // Graticule, drawn under everything.
  layers.push(
    new PathLayer({
      id: 'graticule-minor',
      data: graticule.minor,
      getPath: (d: [number, number][]) => d,
      getColor: C.minor,
      getWidth: 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      parameters: { depthTest: false },
      pickable: false,
    }),
    new PathLayer({
      id: 'graticule-major',
      data: graticule.major,
      getPath: (d: [number, number][]) => d,
      getColor: C.major,
      getWidth: 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      parameters: { depthTest: false },
      pickable: false,
    }),
  )

  // Testimony place (hollow neutral marker).
  if (project.testimony.place) {
    const pl = project.testimony.place
    layers.push(
      new ScatterplotLayer({
        id: 'testimony-place',
        data: [{ position: [pl.lng, pl.lat] }],
        getPosition: (d: { position: [number, number] }) => d.position,
        getRadius: 9,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: C.place,
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  // Unsafe markers get an alert ring behind them, in the editor only.
  const unsafe = anchorPts.filter((p) => p.unsafe)
  if (unsafe.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'unsafe-rings',
        data: unsafe,
        getPosition: (d: PointDatum) => d.position,
        getRadius: 11,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: C.alert,
        getLineWidth: 1.5,
        lineWidthUnits: 'pixels',
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }

  // Statement ground anchors.
  layers.push(
    new ScatterplotLayer({
      id: 'anchors',
      data: anchorPts,
      getPosition: (d: PointDatum) => d.position,
      getRadius: (d: PointDatum) => (d.emphasized ? 7 : 5),
      radiusUnits: 'pixels',
      filled: true,
      getFillColor: (d: PointDatum) => (d.emphasized ? C.sel : C.anchor),
      stroked: true,
      getLineColor: C.anchorLine,
      getLineWidth: (d: PointDatum) => (d.emphasized ? 2 : 1),
      lineWidthUnits: 'pixels',
      parameters: { depthTest: false },
      pickable: true,
      onClick: (info) => {
        const obj = info.object as PointDatum | undefined
        if (obj && args.onPickStatement) args.onPickStatement(obj.statementId)
      },
      updateTriggers: {
        getRadius: [selectedStatementId, hoveredId, activeId],
        getFillColor: [selectedStatementId, hoveredId, activeId, args.ground],
        getLineColor: [args.ground],
        getLineWidth: [selectedStatementId, hoveredId, activeId],
      },
    }),
  )

  if (footprint) {
    layers.push(
      new PolygonLayer({
        id: 'model-footprint',
        data: [footprint],
        getPolygon: (d: [number, number][]) => d,
        getFillColor: C.footprint,
        getLineColor: C.footprintLine,
        lineWidthUnits: 'pixels',
        getLineWidth: 1,
        stroked: true,
        filled: true,
        parameters: { depthTest: false },
        pickable: false,
      }),
    )
  }
  if (cams.length) {
    layers.push(
      new LineLayer({
        id: 'camera-rays',
        data: cams,
        getSourcePosition: (d: (typeof cams)[number]) => d.source,
        getTargetPosition: (d: (typeof cams)[number]) => d.target,
        getColor: (d: (typeof cams)[number]) => (d.camera.id === args.selectedCameraId ? C.sel : C.ray),
        getWidth: (d: (typeof cams)[number]) => (d.camera.id === args.selectedCameraId ? 2.4 : 1.2),
        widthUnits: 'pixels',
        updateTriggers: { getColor: [args.selectedCameraId], getWidth: [args.selectedCameraId] },
        parameters: { depthTest: false },
        pickable: false,
      }),
      new ScatterplotLayer({
        id: 'cameras',
        data: cams,
        getPosition: (d: (typeof cams)[number]) => d.source,
        getRadius: (d: (typeof cams)[number]) => (d.camera.id === args.selectedCameraId ? 6 : 4.5),
        radiusUnits: 'pixels',
        filled: true,
        getFillColor: (d: (typeof cams)[number]) => (d.camera.consent === 'public' ? C.camera : C.alert),
        stroked: true,
        getLineColor: C.anchorLine,
        lineWidthUnits: 'pixels',
        getLineWidth: 1,
        pickable: true,
        onClick: (info) => {
          const d = info.object as (typeof cams)[number] | undefined
          if (d && args.onPickCamera) args.onPickCamera(d.camera.id)
        },
        updateTriggers: { getRadius: [args.selectedCameraId] },
        parameters: { depthTest: false },
      }),
    )
  }

  return layers
}
