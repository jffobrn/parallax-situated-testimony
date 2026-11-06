/**
 * Map colours, keyed to the ground under them rather than to the interface.
 * Over satellite imagery (and the dark grid) the marks are light, so they read
 * against texture; over streets, topo, and the light grid they are violet and
 * raspberry, matching the interface. Raspberry marks the statement in focus;
 * red is kept for protected points.
 */

export type Ground = 'dark' | 'light'
type RGBA = [number, number, number, number]

export interface MapPalette {
  minor: RGBA
  major: RGBA
  anchor: RGBA
  anchorLine: RGBA
  place: RGBA
  alert: RGBA
  sel: RGBA
  measureFill: RGBA
  measureLine: RGBA
  measurePt: RGBA
  measurePtLine: RGBA
}

const DARK: MapPalette = {
  minor: [86, 64, 94, 120],
  major: [122, 96, 132, 170],
  anchor: [234, 210, 247, 255],
  anchorLine: [22, 11, 24, 255],
  place: [255, 255, 255, 255],
  alert: [255, 110, 100, 255],
  sel: [255, 126, 179, 255],
  measureFill: [234, 210, 247, 46],
  measureLine: [234, 210, 247, 235],
  measurePt: [234, 210, 247, 255],
  measurePtLine: [22, 11, 24, 255],
}

const LIGHT: MapPalette = {
  minor: [214, 191, 226, 150],
  major: [185, 150, 204, 210],
  anchor: [90, 22, 102, 255],
  anchorLine: [255, 255, 255, 255],
  place: [75, 59, 79, 255],
  alert: [179, 38, 30, 255],
  sel: [194, 24, 91, 255],
  measureFill: [90, 22, 102, 34],
  measureLine: [90, 22, 102, 230],
  measurePt: [90, 22, 102, 255],
  measurePtLine: [255, 255, 255, 255],
}

export function mapPalette(ground: Ground): MapPalette {
  return ground === 'dark' ? DARK : LIGHT
}

/** Satellite imagery reads as a dark ground; streets and topo as light; the
 *  grid and a local file follow the interface theme. */
export function groundFor(basemap: string, theme: 'light' | 'dark'): Ground {
  if (basemap === 'satellite') return 'dark'
  if (basemap === 'streets' || basemap === 'topo') return 'light'
  return theme
}

/** The grid ground's background, per theme. */
export const GRID_BG = { light: '#f3ebf6', dark: '#2a1c2f' } as const
