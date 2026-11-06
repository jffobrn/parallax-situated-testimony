/**
 * Georeferencing the scene model: tying its own coordinate space to the ground,
 * so that cameras placed in Sightlines and Atlas can stand inside it.
 *
 * Model space is three.js convention: +x east, +y up, and -z north when the
 * model is unrotated. A georeference gives the ground position of the model's
 * origin, the metres one model unit spans, and the model's rotation: the compass
 * bearing (clockwise from true north) along which the model's -z axis points.
 *
 * The ground is treated as a local tangent plane about the origin, which is
 * metre-accurate at the scale of a site. Pure functions; no rendering here.
 */

export interface ModelGeoref {
  /** Ground position of the model's origin (0, 0, 0). */
  origin: { lat: number; lng: number }
  /** Metres spanned by one model unit. */
  metresPerUnit: number
  /** Bearing of the model's -z axis, degrees clockwise from true north. */
  rotationDeg: number
  /** How it was set: typed, solved from two matched points, or the massing's default. */
  basis: 'typed' | 'two-point' | 'procedural'
  /** For a two-point solve: how far apart the two points' implied scales were, in percent. */
  misfitPct?: number
}

const DEG = Math.PI / 180
const M_PER_DEG_LAT = 110_540
const mPerDegLng = (lat: number) => 111_320 * Math.cos(lat * DEG)

/** Metres east and north of the origin. */
export function localEN(origin: { lat: number; lng: number }, p: { lat: number; lng: number }): { e: number; n: number } {
  return { e: (p.lng - origin.lng) * mPerDegLng(origin.lat), n: (p.lat - origin.lat) * M_PER_DEG_LAT }
}

export function fromLocalEN(origin: { lat: number; lng: number }, e: number, n: number): { lat: number; lng: number } {
  return { lat: origin.lat + n / M_PER_DEG_LAT, lng: origin.lng + e / mPerDegLng(origin.lat) }
}

/** A ground point to model x and z (the height is the caller's). */
export function geoToModel(g: ModelGeoref, p: { lat: number; lng: number }): { x: number; z: number } {
  const { e, n } = localEN(g.origin, p)
  const t = g.rotationDeg * DEG
  // Components along the model's +x (east when unrotated) and model north (-z).
  const along = e * Math.cos(t) - n * Math.sin(t)
  const north = e * Math.sin(t) + n * Math.cos(t)
  return { x: along / g.metresPerUnit, z: -north / g.metresPerUnit }
}

/** Model x and z to a ground point. */
export function modelToGeo(g: ModelGeoref, m: { x: number; z: number }): { lat: number; lng: number } {
  const t = g.rotationDeg * DEG
  const along = m.x * g.metresPerUnit
  const north = -m.z * g.metresPerUnit
  const e = along * Math.cos(t) + north * Math.sin(t)
  const n = -along * Math.sin(t) + north * Math.cos(t)
  return fromLocalEN(g.origin, e, n)
}

/** A compass bearing as a unit direction in model x and z. */
export function bearingToModelDir(g: ModelGeoref, bearingDeg: number): { x: number; z: number } {
  const b = (bearingDeg - g.rotationDeg) * DEG
  return { x: Math.sin(b), z: -Math.cos(b) }
}

/** Metres to model units. */
export function metresToUnits(g: ModelGeoref, m: number): number {
  return m / g.metresPerUnit
}

/**
 * Solve the georeference from two points matched in the model and on the
 * ground: the scale from their separations, the rotation from their
 * directions, and the origin from the first pair. Returns null when the two
 * points coincide in either space.
 */
export function solveTwoPoint(
  a: { model: { x: number; z: number }; geo: { lat: number; lng: number } },
  b: { model: { x: number; z: number }; geo: { lat: number; lng: number } },
): ModelGeoref | null {
  // Model vector in model-east / model-north terms.
  const vx = b.model.x - a.model.x
  const vn = -(b.model.z - a.model.z)
  const w = localEN(a.geo, b.geo)
  const lm = Math.hypot(vx, vn)
  const lw = Math.hypot(w.e, w.n)
  if (lm < 1e-9 || lw < 1e-3) return null
  const metresPerUnit = lw / lm
  // Bearing of each vector; the model is rotated by their difference.
  const bw = Math.atan2(w.e, w.n)
  const bv = Math.atan2(vx, vn)
  let rotationDeg = ((bw - bv) / DEG) % 360
  if (rotationDeg < 0) rotationDeg += 360
  // The origin: step back from point a by its model offset, rotated and scaled.
  const t = rotationDeg * DEG
  const ax = a.model.x * metresPerUnit
  const an = -a.model.z * metresPerUnit
  const e = ax * Math.cos(t) + an * Math.sin(t)
  const n = -ax * Math.sin(t) + an * Math.cos(t)
  const origin = fromLocalEN(a.geo, -e, -n)
  return { origin, metresPerUnit, rotationDeg, basis: 'two-point' }
}
