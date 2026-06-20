/**
 * The consent boundary (shared core): publicClone.
 *
 * This is the contribution the suite makes over straight counter-forensics:
 * consent enforced by architecture, not by discipline. ONE function produces
 * every export and every published view. It takes the full project and returns a
 * sanitized copy. In Situated Testimony, where the material is a person's account,
 * the boundary does the most work of any tool in the suite:
 *
 *   - statements that are not `public` (restricted, embargoed) are dropped;
 *   - statements carrying a restricting sovereignty label (community use only,
 *     withholding) are dropped, whatever their consent flag says;
 *   - narrators whose identity is not public are reduced to a stable alias
 *     ("Narrator A") with name and affiliation removed; a narrator left with no
 *     surviving statements is dropped entirely;
 *   - the scene model is withheld unless its consent is public, and when withheld
 *     every surviving statement loses its model anchor;
 *   - the recording's media is never embedded: a voice is the most identifying
 *     part of a testimony, and audio or video is large, so the public artifact
 *     cites the recording by sha-256 and links out, holding no bytes;
 *   - coordinates are withheld (or coarsened) wherever `safeToPublish` is false;
 *   - private notes, real provenance, and held filenames have no field in the
 *     public types, so they cannot appear.
 *
 * Sensitive data cannot leak by accident because nothing sensitive crosses this
 * boundary: the public types in `types.ts` simply do not have fields for it.
 *
 * The function is pure and synchronous. It takes no clock and no I/O so it is
 * trivially testable; the caller stamps `generatedAt`.
 */

import {
  hasRestrictingLabel,
  isRestrictingLabel,
  type GeoPoint,
  type Narrator,
  type Project,
  type PublicAnchor,
  type PublicGeoPoint,
  type PublicLabel,
  type PublicModel,
  type PublicNarrator,
  type PublicProject,
  type PublicRecording,
  type PublicStatement,
  type Redactions,
  type Sovereignty,
  type Statement,
} from './types'

export type UnsafeCoordinatePolicy = 'withhold' | 'coarsen'

export interface PublicCloneOptions {
  /** What to do with a point whose safeToPublish is false. Default: withhold. */
  unsafeCoordinatePolicy?: UnsafeCoordinatePolicy
  /** Decimal places when coarsening an unsafe point. Default 2 (~1.1 km). */
  coarsenDecimals?: number
  /** Precision cap applied to safe coordinates too. Default 5 (~1.1 m). */
  roundSafeDecimals?: number
  /** Timestamp to stamp on the output; the caller owns the clock. */
  generatedAt?: string
}

const DEFAULTS = {
  unsafeCoordinatePolicy: 'withhold' as UnsafeCoordinatePolicy,
  coarsenDecimals: 2,
  roundSafeDecimals: 5,
}

function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

/** Stable alias generator: A, B, ... Z, AA, AB, ... */
function aliasFor(index: number): string {
  let i = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (i % 26)) + s
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return `Narrator ${s}`
}

/** Keep only the sovereignty labels that are shown (the non-restricting ones). */
function shownLabels(s: Sovereignty | undefined): PublicLabel[] {
  if (!s) return []
  return s.labels
    .filter((l) => !isRestrictingLabel(l.code))
    .map((l) => ({ code: l.code, text: l.text, note: l.note }))
}

export function publicClone(
  project: Project,
  options: PublicCloneOptions = {},
): PublicProject {
  const opts = { ...DEFAULTS, ...options }
  const { testimony } = project
  const redactions: Redactions = {
    statementsDropped: 0,
    droppedByConsent: { restricted: 0, embargoed: 0 },
    droppedByLabel: 0,
    narratorsAliased: 0,
    narratorsWithheld: 0,
    coordinatesWithheld: 0,
    coordinatesCoarsened: 0,
    modelWithheld: false,
    recordingMediaWithheld: false,
  }

  // Coordinate handling, shared by every point. Returns undefined when withheld.
  const cleanPoint = (p?: GeoPoint): PublicGeoPoint | undefined => {
    if (!p) return undefined
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return undefined
    if (p.safeToPublish) {
      return {
        lat: roundTo(p.lat, opts.roundSafeDecimals),
        lng: roundTo(p.lng, opts.roundSafeDecimals),
      }
    }
    if (opts.unsafeCoordinatePolicy === 'coarsen') {
      redactions.coordinatesCoarsened++
      return {
        lat: roundTo(p.lat, opts.coarsenDecimals),
        lng: roundTo(p.lng, opts.coarsenDecimals),
        coarsened: true,
      }
    }
    redactions.coordinatesWithheld++
    return undefined
  }

  // 1. The model: kept only when its consent is public. When withheld, model
  //    anchors are stripped from every surviving statement.
  const modelIsPublic = !!testimony.model && testimony.model.consent === 'public'
  if (testimony.model && !modelIsPublic) redactions.modelWithheld = true
  const model: PublicModel | undefined =
    testimony.model && modelIsPublic
      ? {
          id: testimony.model.id,
          title: testimony.model.title,
          kind: testimony.model.kind,
          file: testimony.model.file
            ? {
                mime: testimony.model.file.mime,
                bytes: testimony.model.file.bytes,
                sha256: testimony.model.file.sha256,
              }
            : undefined,
        }
      : undefined

  // 2. Statements: drop non-public, drop restricting-label, then clean.
  const statements: PublicStatement[] = []
  const survivingNarratorIds = new Set<string>()
  for (const st of project.statements) {
    if (st.consent !== 'public') {
      redactions.statementsDropped++
      if (st.consent === 'restricted') redactions.droppedByConsent.restricted++
      if (st.consent === 'embargoed') redactions.droppedByConsent.embargoed++
      continue
    }
    if (hasRestrictingLabel(st.sovereignty)) {
      redactions.statementsDropped++
      redactions.droppedByLabel++
      continue
    }
    statements.push(cleanStatement(st))
    if (st.narratorId) survivingNarratorIds.add(st.narratorId)
  }

  function cleanStatement(st: Statement): PublicStatement {
    let anchor: PublicAnchor | undefined
    const geo = cleanPoint(st.anchor?.geo)
    const modelAnchor = modelIsPublic ? st.anchor?.model : undefined
    if (geo || modelAnchor) {
      anchor = { geo, model: modelAnchor }
    }
    return {
      id: st.id,
      narratorId: st.narratorId,
      text: st.text,
      clip: st.clip,
      refersTo: st.refersTo,
      anchor,
      certainty: st.certainty,
      labels: shownLabels(st.sovereignty),
      tags: st.tags,
      // Intentionally omitted: note (private), the consent flag, restricting labels.
    }
  }

  // 3. Narrators: name the public ones, alias the protected ones that survive,
  //    drop the unheard. Aliases are assigned in narrator order over the
  //    survivors only, so the A / B / C sequence never has gaps.
  const aliasByNarrator = new Map<string, string>()
  let aliasCount = 0
  for (const n of testimony.narrators) {
    if (n.identityConsent !== 'public' && survivingNarratorIds.has(n.id)) {
      aliasByNarrator.set(n.id, aliasFor(aliasCount++))
    }
  }
  const publicNarrators: PublicNarrator[] = []
  for (const n of testimony.narrators) {
    if (!survivingNarratorIds.has(n.id)) {
      // A narrator with nothing publishable is not listed at all.
      redactions.narratorsWithheld++
      continue
    }
    publicNarrators.push(publicNarrator(n))
  }

  function publicNarrator(n: Narrator): PublicNarrator {
    if (n.identityConsent === 'public') {
      return {
        id: n.id,
        name: n.name?.trim() || 'Unnamed narrator',
        aliased: false,
        role: n.role,
        affiliation: n.affiliation,
      }
    }
    redactions.narratorsAliased++
    return {
      id: n.id,
      name: aliasByNarrator.get(n.id) ?? 'Narrator',
      aliased: true,
      role: n.role,
      // affiliation intentionally omitted for a protected identity.
    }
  }

  // 4. Recording: cite by hash, never embed the media bytes.
  let recording: PublicRecording | undefined
  if (testimony.recording) {
    const r = testimony.recording
    if (r.file) redactions.recordingMediaWithheld = true
    recording = {
      medium: r.medium,
      title: r.title,
      durationSec: r.durationSec ?? r.file?.durationSec,
      recordedOn: r.recordedOn,
      file: r.file
        ? {
            mime: r.file.mime,
            bytes: r.file.bytes,
            sha256: r.file.sha256,
            durationSec: r.file.durationSec,
          }
        : undefined,
      link: r.link
        ? {
            url: r.link.url,
            archivedUrl: r.link.archivedUrl,
            archivedSha256: r.link.archivedSha256,
            archivedAt: r.link.archivedAt,
          }
        : undefined,
    }
  }

  // 5. Testimony identity, with the same coordinate discipline on its place.
  const placePublic = testimony.place ? cleanPoint(testimony.place) : undefined

  return {
    testimony: {
      id: testimony.id,
      titles: testimony.titles,
      subject: testimony.subject,
      narrators: publicNarrators,
      recording,
      model,
      place:
        testimony.place && placePublic
          ? { ...placePublic, name: testimony.place.name }
          : undefined,
      window: testimony.window,
      summary: testimony.summary,
      rightsHolder: testimony.sovereignty.rightsHolder,
      labels: shownLabels(testimony.sovereignty),
      tags: testimony.tags,
    },
    statements,
    redactions,
    generatedAt: opts.generatedAt,
  }
}

/** Human-readable lines describing what the boundary removed, for disclosure. */
export function redactionLines(r: Redactions): string[] {
  const lines: string[] = []
  if (r.statementsDropped > 0) {
    const parts: string[] = []
    if (r.droppedByConsent.embargoed)
      parts.push(`${r.droppedByConsent.embargoed} embargoed`)
    if (r.droppedByConsent.restricted)
      parts.push(`${r.droppedByConsent.restricted} restricted`)
    if (r.droppedByLabel)
      parts.push(`${r.droppedByLabel} withheld by a sovereignty label`)
    const detail = parts.length ? ` (${parts.join(', ')})` : ''
    lines.push(
      `${r.statementsDropped} statement${r.statementsDropped === 1 ? '' : 's'} withheld${detail}`,
    )
  }
  if (r.narratorsAliased > 0)
    lines.push(
      `${r.narratorsAliased} narrator identit${r.narratorsAliased === 1 ? 'y' : 'ies'} reduced to an alias`,
    )
  if (r.narratorsWithheld > 0)
    lines.push(
      `${r.narratorsWithheld} narrator${r.narratorsWithheld === 1 ? '' : 's'} omitted for having no publishable statements`,
    )
  if (r.modelWithheld) lines.push('the 3D model was withheld; its anchors were removed')
  if (r.recordingMediaWithheld)
    lines.push('recording media is cited by hash, not embedded, to protect the voice')
  if (r.coordinatesWithheld > 0)
    lines.push(
      `${r.coordinatesWithheld} coordinate${r.coordinatesWithheld === 1 ? '' : 's'} withheld as unsafe to publish`,
    )
  if (r.coordinatesCoarsened > 0)
    lines.push(
      `${r.coordinatesCoarsened} coordinate${r.coordinatesCoarsened === 1 ? '' : 's'} coarsened`,
    )
  if (lines.length === 0) lines.push('Nothing required redaction.')
  return lines
}
