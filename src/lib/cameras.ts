/**
 * Reading camera positions out of a Sightlines or Atlas project file. Only the
 * placed vantages are read (position, bearing, field of view, confidence) with
 * each photograph's title and consent; the file is tethered by its sha-256, and
 * nothing else of its record is kept. The input is untrusted JSON, so every
 * field is read defensively.
 */

import { newId, sha256Hex, type CameraSet, type Certainty, type Consent, type ModelGeoref, type RefCamera } from '../core'

interface Loose {
  [k: string]: unknown
}
const obj = (v: unknown): Loose => (v && typeof v === 'object' ? (v as Loose) : {})
const arr = (v: unknown): Loose[] => (Array.isArray(v) ? (v as Loose[]) : [])
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const CONSENTS: Consent[] = ['public', 'restricted', 'embargoed']
const CERTAINTIES: Certainty[] = ['attested', 'probable', 'uncertain']

function firstText(v: unknown): string {
  if (typeof v === 'string') return v
  for (const t of arr(v)) if (typeof t.text === 'string' && t.text.trim()) return t.text
  return ''
}

/** The cameras in a parsed project file, or an error message. */
export function camerasFromProjectFile(json: unknown): { tool: CameraSet['tool']; title: string; cameras: RefCamera[] } | string {
  const file = obj(json)
  const format = file.format
  const project = obj(file.project)
  let tool: CameraSet['tool']
  let items: Loose[]
  let title: string
  if (format === 'sightlines-project') {
    tool = 'sightlines'
    items = arr(project.sources)
    title = firstText(obj(project.incident).titles) || 'Sightlines project'
  } else if (format === 'atlas-project') {
    tool = 'atlas'
    items = arr(project.images)
    title = firstText(obj(project.atlas).titles) || 'Atlas project'
  } else {
    return 'Not a Sightlines or Atlas project file.'
  }
  const cameras: RefCamera[] = []
  for (const it of items) {
    const v = obj(it.vantage)
    const lat = num(v.lat)
    const lng = num(v.lng)
    const bearingDeg = num(v.bearingDeg)
    if (lat === null || lng === null || bearingDeg === null) continue
    const consent = CONSENTS.includes(it.consent as Consent) ? (it.consent as Consent) : 'restricted'
    const confidence = CERTAINTIES.includes(v.confidence as Certainty) ? (v.confidence as Certainty) : 'uncertain'
    cameras.push({
      id: newId('cam'),
      label: typeof it.title === 'string' && it.title.trim() ? it.title : 'Untitled photograph',
      lat,
      lng,
      bearingDeg,
      fovDeg: num(v.fovDeg) ?? undefined,
      confidence,
      consent,
      safeToPublish: v.safeToPublish !== false,
    })
  }
  if (cameras.length === 0) return 'That project has no placed camera vantages.'
  return { tool, title, cameras }
}

/** Read a picked file into a camera set, hashing its bytes for fixity. */
export async function cameraSetFromFile(file: File): Promise<CameraSet | string> {
  const bytes = await file.arrayBuffer()
  let json: unknown
  try {
    json = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return 'That file is not valid JSON.'
  }
  const read = camerasFromProjectFile(json)
  if (typeof read === 'string') return read
  return {
    id: newId('camset'),
    tool: read.tool,
    title: read.title,
    fileName: file.name,
    sha256: await sha256Hex(bytes),
    importedAt: new Date().toISOString(),
    cameras: read.cameras,
  }
}

/**
 * The georeference in force: the model's own, or for the procedural massing,
 * one taken from the testimony's place (one unit per metre, unrotated).
 */
export function effectiveGeoref(t: {
  model?: { kind: string; georef?: ModelGeoref }
  place?: { lat: number; lng: number }
}): ModelGeoref | null {
  if (t.model?.georef) return t.model.georef
  const procedural = !t.model || t.model.kind === 'procedural'
  if (procedural && t.place) return { origin: { lat: t.place.lat, lng: t.place.lng }, metresPerUnit: 1, rotationDeg: 0, basis: 'procedural' }
  return null
}

/** Every imported camera, with the set it came from. */
export function allCameras(t: { cameraSets?: CameraSet[] }): { camera: RefCamera; set: CameraSet }[] {
  return (t.cameraSets ?? []).flatMap((set) => set.cameras.map((camera) => ({ camera, set })))
}
