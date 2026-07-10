/**
 * Situated Testimony / Parallax suite: the typed data model.
 *
 * A testimony is an account, segmented into time-coded statements, each anchored
 * in space (a point on a 3D model and/or a point on the map), ordered in time,
 * and governed by its own consent and sovereignty. Where Sightlines reconstructs
 * an incident and Atlas assembles an image complex, Situated Testimony situates
 * memory: it puts a witness back inside a place and records where a memory
 * attaches. It is the tool that carries the data-sovereignty thread (CARE, OCAP,
 * TK Labels, ATALM) into the centre of the model, not the edge.
 *
 * This is shared core. The primitives carried over from Sightlines and Atlas
 * unchanged (Consent, Certainty, TimePrecision, GeoPoint, Vantage, LocalizedText,
 * HeldFile, ExternalLink) keep the tools interoperable, so material can move
 * between them without ever loosening protection. Keep this a clean module with
 * no UI or framework imports.
 *
 * A note on truth: only the project (testimony, statements) is stored. Everything
 * derived (timeline order, the anchors drawn, the active statement under the
 * playhead, the narrative) is computed at read time, never persisted as fact.
 */

/** Whether a statement, a narrator's identity, or a model may appear in anything published. */
export type Consent = 'public' | 'restricted' | 'embargoed'

/** How sure an assertion, a placement, or a remembered fact is. */
export type Certainty = 'attested' | 'probable' | 'uncertain'

/** A datetime carries the precision it was actually known to, never more. */
export type TimePrecision = 'minute' | 'hour' | 'day' | 'approximate'

/** What the testimony is principally about. */
export type TestimonySubject = 'event' | 'place' | 'work' | 'life' | 'practice'

/** Who is speaking, as a bearer of the account. */
export type NarratorRole =
  | 'witness'
  | 'survivor'
  | 'artist'
  | 'elder'
  | 'family'
  | 'expert'
  | 'official'
  | 'other'

/** How the account was recorded. */
export type RecordingMedium = 'audio' | 'video' | 'transcript-only'

/** Whether the scene is a loaded glTF model or a neutral procedural massing. */
export type ModelKind = 'gltf' | 'procedural'

// --- Sovereignty (the lean layer) ------------------------------------------
// A curated set of protections a rights-holder may assign. The tool RECORDS and
// RESPECTS labels a community has set; it does not mint official Local Contexts
// labels. Two of them restrict publication and are enforced by the consent
// boundary; the rest are shown as attribution.

export type LabelCode =
  | 'attribution' // must be credited; shown
  | 'non-commercial' // not for commercial use; shown
  | 'outreach' // open for education and outreach; shown
  | 'community-use' // community use only; ENFORCED: withheld from the public build
  | 'withholding' // explicitly withheld; ENFORCED: withheld from the public build
  | 'custom' // a free-text label, shown

/** The labels that, when present, force content out of anything published. */
export const RESTRICTING_LABELS: readonly LabelCode[] = ['community-use', 'withholding']

export function isRestrictingLabel(code: LabelCode): boolean {
  return RESTRICTING_LABELS.includes(code)
}

export interface SovereigntyLabel {
  code: LabelCode
  /** Display wording, e.g. "Community Use Only" or the custom text. */
  text: string
  note?: string
}

/**
 * Rights-holder and labels, at the testimony or the statement level.
 * `rightsHolder` is published as credit, so it should name a community or
 * collective, not a protected individual.
 */
export interface Sovereignty {
  rightsHolder?: string
  labels: SovereigntyLabel[]
}

export function blankSovereignty(): Sovereignty {
  return { labels: [] }
}

/** True when any label here restricts publication. */
export function hasRestrictingLabel(s: Sovereignty | undefined): boolean {
  return !!s?.labels.some((l) => isRestrictingLabel(l.code))
}

// --- Shared spatial and bibliographic primitives ---------------------------

/** A point on the ground, with a per-point decision about publication. */
export interface GeoPoint {
  lat: number
  lng: number
  /** When false, the consent boundary withholds or coarsens this point. */
  safeToPublish: boolean
}

/**
 * A facing on the ground: a point and the compass bearing (degrees, 0 = north,
 * clockwise) it looked along. Kept for interoperability with the other tools and
 * for recording which way a witness faced.
 */
export interface Vantage extends GeoPoint {
  bearingDeg: number
  fovDeg?: number
  confidence: Certainty
}

/** A point on the 3D model, in the model's own coordinate space. */
export interface ModelAnchor {
  x: number
  y: number
  z: number
}

/** Where a statement attaches: a point on the model and/or a point on the map. */
export interface Anchor {
  model?: ModelAnchor
  geo?: GeoPoint
}

/** A text in one language, so a record can be multilingual (including RTL). */
export interface LocalizedText {
  text: string
  /** BCP-47-ish language tag, e.g. 'en', 'ar'. Direction is derived per string. */
  lang: string
}

/** Bytes actually held on the user's machine, with their fixity hash. */
export interface HeldFile {
  name: string
  mime: string
  bytes: number
  /** Lowercase hex sha-256 of the held bytes (Berkeley Protocol fixity). */
  sha256: string
  w?: number
  h?: number
  /** Length in seconds, for held audio or video. */
  durationSec?: number
  /** Key into the media store (IndexedDB). Not part of the evidentiary record. */
  blobKey?: string
}

/** A link to material not downloaded (a recording online). We hash what we hold. */
export interface ExternalLink {
  url: string
  archivedUrl?: string
  /** sha-256 of the archived snapshot we hold, never of the remote bytes. */
  archivedSha256?: string
  archivedAt?: string
}

// --- The testimony itself --------------------------------------------------

/** Who is speaking. Identity is sensitive and consent-gated. */
export interface Narrator {
  id: string
  /** Real name. Published only when identityConsent is public; otherwise aliased. */
  name?: string
  role: NarratorRole
  /** Withheld from anything published unless the identity is public. */
  affiliation?: string
  /** Governs whether this person may be named in published output. */
  identityConsent: Consent
  /** Private curatorial note. Never published. */
  note?: string
}

/** The account as recorded: the evidentiary bearer of the spoken testimony. */
export interface Recording {
  id: string
  medium: RecordingMedium
  title: string
  /** The audio or video, held locally and hashed. Absent for transcript-only. */
  file?: HeldFile
  /** Or a link to a recording not held; we hash an archived snapshot, not the bytes. */
  link?: ExternalLink
  /** Total length in seconds; drives the transport when no file is present. */
  durationSec?: number
  recordedOn?: { value: string; precision: TimePrecision }
  note?: string
}

/**
 * The scene the testimony is situated in: a loaded glTF model or, when none is
 * set, a neutral procedural massing. A model can itself be sensitive (a sacred
 * site), so it carries its own consent; when not public, the boundary withholds
 * it and strips model anchors from published statements.
 */
export interface SceneModel {
  id: string
  title: string
  kind: ModelKind
  /** A glTF/glb held locally and hashed. Absent for a procedural scene. */
  file?: HeldFile
  /** A glTF/glb loaded from a URL for the working view; nothing is downloaded. */
  url?: string
  consent: Consent
  note?: string
}

/**
 * One time-coded segment of the account: the atomic unit. It carries the words,
 * an optional clip into the recording, the real-world time it refers to, where in
 * space it attaches, how reliable the memory is, and its own consent and
 * sovereignty.
 */
export interface Statement {
  id: string
  /** Who said it. Defaults to the first narrator when unset. */
  narratorId?: string
  text: LocalizedText[]
  /** Location within the recording, in seconds. */
  clip?: { startSec: number; endSec?: number }
  /** The real-world time the memory is about (not when it was recorded). */
  refersTo?: { value: string; precision: TimePrecision }
  anchor?: Anchor
  certainty: Certainty
  consent: Consent
  sovereignty: Sovereignty
  /** Private curatorial note. Never published. */
  note?: string
  tags: string[]
}

/** The testimony identity: whose account, of what, situated where and when. */
export interface Testimony {
  id: string
  titles: LocalizedText[]
  subject: TestimonySubject
  narrators: Narrator[]
  recording?: Recording
  model?: SceneModel
  place?: GeoPoint & { name?: string }
  window: { start?: string; end?: string; precision: TimePrecision }
  summary?: string
  sovereignty: Sovereignty
  tags: string[]
}

export interface Project {
  testimony: Testimony
  statements: Statement[]
}

// --- Export envelope -------------------------------------------------------

export const SCHEMA_VERSION = 1

/**
 * The full project as written to a single file (the user's own keeping). This is
 * the one output that is NOT sanitized; it never leaves the machine unless the
 * user saves it. Media bytes are inlined as base64 so the project is one portable
 * file.
 */
export interface ProjectFile {
  format: 'situated-testimony-project'
  schemaVersion: number
  app: { name: string; version: string }
  exportedAt: string
  project: Project
  /** blobKey -> { mime, base64 } for every held file referenced above. */
  media: Record<string, { mime: string; base64: string }>
}

// --- Public (consent-cleared) projection -----------------------------------
// What survives the consent boundary. Sensitive fields are simply absent from
// these types, so they cannot be rendered even by mistake downstream.

export interface PublicGeoPoint {
  lat: number
  lng: number
  /** True when the coordinate was coarsened because it was not safe to publish. */
  coarsened?: boolean
}

export interface PublicAnchor {
  /** Present only when the model survived the boundary. */
  model?: ModelAnchor
  geo?: PublicGeoPoint
}

/** A label kept for display in published output (the non-restricting ones). */
export interface PublicLabel {
  code: LabelCode
  text: string
  note?: string
}

export interface PublicNarrator {
  id: string
  /** Real name when identity is public, otherwise a stable alias ("Narrator A"). */
  name: string
  /** True when the name is an alias, the real identity withheld. */
  aliased: boolean
  role: NarratorRole
  /** Only present when the identity is public. */
  affiliation?: string
}

export interface PublicFileRef {
  mime: string
  bytes: number
  /** Fixity is kept even though the bytes are not embedded. */
  sha256: string
  durationSec?: number
}

export interface PublicLink {
  url: string
  archivedUrl?: string
  archivedSha256?: string
  archivedAt?: string
}

export interface PublicRecording {
  medium: RecordingMedium
  title: string
  durationSec?: number
  recordedOn?: { value: string; precision: TimePrecision }
  /** Recording media is cited by hash, never embedded in the public build. */
  file?: PublicFileRef
  link?: PublicLink
}

export interface PublicModel {
  id: string
  title: string
  kind: ModelKind
  file?: PublicFileRef
}

export interface PublicStatement {
  id: string
  narratorId?: string
  text: LocalizedText[]
  clip?: { startSec: number; endSec?: number }
  refersTo?: { value: string; precision: TimePrecision }
  anchor?: PublicAnchor
  certainty: Certainty
  /** The shown sovereignty labels (restricting labels never reach here). */
  labels: PublicLabel[]
  tags: string[]
}

export interface PublicTestimony {
  id: string
  titles: LocalizedText[]
  subject: TestimonySubject
  narrators: PublicNarrator[]
  recording?: PublicRecording
  model?: PublicModel
  place?: PublicGeoPoint & { name?: string }
  window: { start?: string; end?: string; precision: TimePrecision }
  summary?: string
  /** Rights-holder credit, published as attribution. */
  rightsHolder?: string
  labels: PublicLabel[]
  tags: string[]
}

/** A record of what the consent boundary removed or altered, for honest disclosure. */
export interface Redactions {
  statementsDropped: number
  droppedByConsent: { restricted: number; embargoed: number }
  droppedByLabel: number
  narratorsAliased: number
  narratorsWithheld: number
  coordinatesWithheld: number
  coordinatesCoarsened: number
  modelWithheld: boolean
  recordingMediaWithheld: boolean
}

export interface PublicProject {
  testimony: PublicTestimony
  statements: PublicStatement[]
  redactions: Redactions
  generatedAt?: string
}
