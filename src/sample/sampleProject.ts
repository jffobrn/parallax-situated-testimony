/**
 * The sample testimony. Plainly fictional, continuing the suite's fiction: an
 * oral history about the whitewashed Sea-Wall Mural of the invented town of Vela
 * (the same fiction as the Sightlines and Atlas samples). An aged resident and an
 * art historian recall the wall, the work, its erasure, and its afterlife. The
 * town, the people, the coordinates, and the dates are invented; only the file
 * hash is real, computed here over the synthesised recording bytes.
 *
 * It exercises every distinctive feature of Situated Testimony: statements
 * anchored to points on the procedural model and on the map; a recording (a short
 * placeholder room tone, so the transport plays and the clips cue real audio);
 * per-statement consent including one embargoed statement; a community-use label
 * that publishing enforces; one narrator whose identity is restricted, so
 * publishing aliases them, beside one who is named; a coordinate marked not safe
 * to publish; and a rights-holder credit and attribution label that publish.
 */

import {
  blankSovereignty,
  putMedia,
  sha256Hex,
  type HeldFile,
  type Narrator,
  type Project,
  type Recording,
  type SceneModel,
  type Statement,
  type Testimony,
} from '../core'

// --- A short, deterministic placeholder recording (room tone) --------------
// A calm low bed, synthesised so it is real, hashable, scrubbable audio without
// standing in for a human voice. Deterministic, so its hash is stable.

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRoomToneWav(durationSec: number, sampleRate = 8000): ArrayBuffer {
  const numSamples = Math.floor(durationSec * sampleRate)
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const rng = mulberry32(20260619)
  let lp = 0
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const noise = rng() * 2 - 1
    lp = lp * 0.96 + noise * 0.04 // a gentle low-pass on the noise
    const drone = 0.016 * Math.sin(2 * Math.PI * 60 * t) + 0.01 * Math.sin(2 * Math.PI * 90 * t)
    let s = drone + lp * 0.5
    s = Math.max(-1, Math.min(1, s))
    view.setInt16(44 + i * 2, Math.round(s * 32767), true)
  }
  return buffer
}

async function heldRecording(durationSec: number): Promise<HeldFile> {
  const buffer = makeRoomToneWav(durationSec)
  const sha256 = await sha256Hex(buffer)
  const blobKey = 'media_sample_recording'
  await putMedia(blobKey, new Blob([buffer], { type: 'audio/wav' }))
  return {
    name: 'oral-history-vela.wav',
    mime: 'audio/wav',
    bytes: buffer.byteLength,
    sha256,
    durationSec,
    blobKey,
  }
}

const DURATION = 96

// The wall, matching the other samples' fiction.
const WALL = { lat: 34.4052, lng: -19.8503 }

export async function buildSampleProject(): Promise<Project> {
  const recordingFile = await heldRecording(DURATION)

  const narrators: Narrator[] = [
    {
      id: 'nar-resident',
      name: 'Mme. A. (resident)',
      role: 'witness',
      affiliation: 'lifelong resident of the Quai des Marais',
      // Restricted: publishing reduces this person to an alias.
      identityConsent: 'restricted',
      note: 'Identity held back at her request; she agreed to be heard, not named.',
    },
    {
      id: 'nar-historian',
      name: 'Dr. L. Haddad',
      role: 'expert',
      affiliation: 'art historian (fictional)',
      identityConsent: 'public',
    },
  ]

  const recording: Recording = {
    id: 'rec-1',
    medium: 'audio',
    title: 'Oral history session at the quay (placeholder room tone)',
    file: recordingFile,
    durationSec: DURATION,
    recordedOn: { value: '2019-04-11T00:00:00Z', precision: 'day' },
    note: 'A short synthesised room tone stands in for the recording in this fictional sample.',
  }

  const model: SceneModel = {
    id: 'mdl-1',
    title: 'Vela waterfront, schematic massing',
    kind: 'procedural',
    consent: 'public',
    note: 'A neutral massing of the quay, the sea wall, and the buildings behind it. Schematic, not a survey.',
  }

  const statements: Statement[] = [
    {
      id: 'st-1',
      narratorId: 'nar-resident',
      text: [
        {
          text: 'I was a girl when Sarrouf painted the wall. He worked from a plank scaffold, and the central figure faced the sea, so the whole quarter could see it from the water.',
          lang: 'en',
        },
      ],
      clip: { startSec: 0, endSec: 16 },
      refersTo: { value: '1979-06-02T00:00:00Z', precision: 'day' },
      anchor: { model: { x: -4, y: 1.6, z: 4.4 } },
      certainty: 'attested',
      consent: 'public',
      sovereignty: { rightsHolder: 'the residents of Vela (fictional)', labels: [{ code: 'attribution', text: 'Attribution' }] },
      tags: ['mural', 'making'],
    },
    {
      id: 'st-2',
      narratorId: 'nar-resident',
      text: [
        {
          text: 'The blues he used came from the chandler on the corner. When the light dropped in the evening the wall seemed to hold the colour of the harbour.',
          lang: 'en',
        },
      ],
      clip: { startSec: 16, endSec: 31 },
      refersTo: { value: '1979-08-01T00:00:00Z', precision: 'approximate' },
      anchor: { model: { x: -7, y: 5, z: -2.5 } },
      certainty: 'probable',
      consent: 'public',
      sovereignty: blankSovereignty(),
      tags: ['mural', 'colour'],
    },
    {
      id: 'st-3',
      narratorId: 'nar-historian',
      text: [
        {
          text: 'The 1981 municipal survey is the firmest record we have of the finished work. It places the mural squarely within the late waterfront commissions, before the demolitions began.',
          lang: 'en',
        },
      ],
      clip: { startSec: 31, endSec: 48 },
      refersTo: { value: '1981-09-12T00:00:00Z', precision: 'day' },
      anchor: { geo: { lat: 34.4049, lng: -19.8499, safeToPublish: true } },
      certainty: 'attested',
      consent: 'public',
      sovereignty: blankSovereignty(),
      tags: ['context', 'survey'],
    },
    {
      id: 'st-4',
      narratorId: 'nar-resident',
      text: [
        {
          text: 'They whitewashed it in a single morning in the summer of 1992. I stood here on the quay and watched the figure go under the paint.',
          lang: 'en',
        },
        {
          text: 'طُليَ الجدار بالأبيض في صباح واحد من صيف 1992. وقفتُ على الرصيف وشاهدتُ الوجه يختفي تحت الطلاء.',
          lang: 'ar',
        },
      ],
      clip: { startSec: 48, endSec: 64 },
      refersTo: { value: '1992-08-15T00:00:00Z', precision: 'day' },
      anchor: { model: { x: 5, y: 1.3, z: 4.4 }, geo: { ...WALL, safeToPublish: true } },
      certainty: 'attested',
      consent: 'public',
      sovereignty: blankSovereignty(),
      tags: ['erasure', 'whitewash'],
    },
    {
      id: 'st-5',
      narratorId: 'nar-resident',
      text: [
        {
          text: 'A piece of the plaster was saved. It hung for years in a courtyard I will not point to, because the family who kept it never wanted visitors.',
          lang: 'en',
        },
      ],
      clip: { startSec: 64, endSec: 78 },
      refersTo: { value: '1994-05-01T00:00:00Z', precision: 'approximate' },
      // The courtyard's location is protected: the coordinate is withheld on publish.
      anchor: { geo: { lat: 34.4071, lng: -19.8466, safeToPublish: false } },
      certainty: 'probable',
      consent: 'public',
      sovereignty: blankSovereignty(),
      tags: ['fragment', 'afterlife'],
    },
    {
      id: 'st-6',
      narratorId: 'nar-resident',
      text: [
        {
          text: 'There was a song the quarter sang at the launch of the boats, in front of the wall. It belongs to the families here, and it is not mine to put into the world.',
          lang: 'en',
        },
      ],
      clip: { startSec: 78, endSec: 88 },
      refersTo: { value: '1980-01-01T00:00:00Z', precision: 'approximate' },
      anchor: { model: { x: 0, y: 0.2, z: 9 } },
      certainty: 'probable',
      // Public consent, but a community-use label withholds it from the public build.
      consent: 'public',
      sovereignty: {
        rightsHolder: 'the families of the Quai des Marais (fictional)',
        labels: [{ code: 'community-use', text: 'Community Use Only', note: 'Shared for the community, not for open publication.' }],
      },
      tags: ['song', 'community'],
    },
    {
      id: 'st-7',
      narratorId: 'nar-resident',
      text: [
        {
          text: 'My neighbour took the order to paint it over. I will say his name here, for the record, but not for the world.',
          lang: 'en',
        },
      ],
      clip: { startSec: 88, endSec: 96 },
      refersTo: { value: '1992-08-14T00:00:00Z', precision: 'day' },
      anchor: { model: { x: 6, y: 2.5, z: -2.5 } },
      certainty: 'uncertain',
      // Embargoed: kept in the project file, withheld from anything published.
      consent: 'embargoed',
      sovereignty: blankSovereignty(),
      note: 'Names a living individual; embargoed, so it never crosses the consent boundary.',
      tags: ['embargoed', 'erasure'],
    },
  ]

  const testimony: Testimony = {
    id: 'testimony-sea-wall',
    titles: [
      { text: 'Watching the Wall: an oral history of the Sea-Wall Mural', lang: 'en' },
      { text: 'مشاهدة الجدار: تاريخ شفوي لجدارية البحر', lang: 'ar' },
    ],
    subject: 'place',
    narrators,
    recording,
    model,
    place: { ...WALL, safeToPublish: true, name: 'Sea wall, Quai des Marais, Vela (fictional)' },
    window: { start: '1979-06-02T00:00:00Z', end: '1995-03-01T00:00:00Z', precision: 'day' },
    summary:
      'A plainly fictional sample. Two voices recall the modernist Sea-Wall Mural, painted in 1979 by the invented artist N. Sarrouf in the invented town of Vela and whitewashed in 1992: a lifelong resident whose identity is held back, and a named art historian. The town, the people, the coordinates, and the dates are invented; only the recording hash is real. Scrub the recording or pick a statement to orbit the model and fly the map to where each memory attaches, and publish to watch the embargoed statement, the community-use song, the protected courtyard, and the resident’s name fall away at the consent boundary.',
    sovereignty: {
      rightsHolder: 'the residents of Vela (fictional)',
      labels: [{ code: 'attribution', text: 'Attribution' }],
    },
    tags: ['fictional-sample', 'oral-history', 'mural', 'erasure', 'situated-testimony'],
  }

  return { testimony, statements }
}
