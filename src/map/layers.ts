/**
 * deck.gl layer construction for the map. Pure: given the project, the selection,
 * and a graticule, it returns the layer stack. Situated Testimony draws the
 * testimony place and each statement's ground anchor; selecting an anchor selects
 * its statement, and the active statement (under the playhead) is emphasized.
 */

import type { Layer } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Project } from '../core'
import type { Graticule } from './basemap'

type RGBA = [number, number, number, number]

const C = {
  minor: [40, 48, 60, 110] as RGBA,
  major: [56, 66, 79, 170] as RGBA,
  subject: [127, 168, 191, 255] as RGBA,
  subjectLine: [188, 214, 228, 255] as RGBA,
  place: [167, 176, 189, 255] as RGBA,
  alert: [229, 84, 75, 255] as RGBA,
  sel: [255, 193, 99, 255] as RGBA,
}

export interface BuildLayersArgs {
  project: Project
  selectedStatementId: string | null
  hoveredId: string | null
  activeId: string | null
  graticule: Graticule
  onPickStatement?: (id: string) => void
}

interface PointDatum {
  position: [number, number]
  statementId: string
  emphasized: boolean
  unsafe: boolean
}

export function buildMapLayers(args: BuildLayersArgs): Layer[] {
  const { project, selectedStatementId, hoveredId, activeId, graticule } = args
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
      getFillColor: C.subject,
      stroked: true,
      getLineColor: (d: PointDatum) => (d.emphasized ? C.sel : C.subjectLine),
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
        getLineColor: [selectedStatementId, hoveredId, activeId],
        getLineWidth: [selectedStatementId, hoveredId, activeId],
      },
    }),
  )

  return layers
}
