# Situated Testimony

**Anchor a witness or artist account to a 3D model, a map, and a timeline,
consent and sovereignty first.** The third tool of the **Parallax** suite, a
consent-first counter-forensic toolkit for art history and the archive.

Situated Testimony records an account as a sequence of time-coded **statements**
and situates each one in space: a point on a 3D model and a point on the map,
ordered on a timeline. It is the suite's answer to Forensic Architecture's
situated testimony, putting a witness back inside the place and recording where a
memory attaches, and it makes the move Forensic Architecture does not: it puts
**consent and data sovereignty at the centre**.

It documents and corroborates; it does not adjudicate.

## Three readings of one account

- **Transcript** : the statements as a readable, time-coded column, the spine of
  the tool.
- **Model** : a 3D scene (a loaded glTF, or a neutral procedural massing) with
  each statement's anchor as a marker.
- **Map** : the testimony place and each statement's ground anchor, on a tokenless
  MapLibre map that fetches no tiles.

A recording transport plays the account; scrub it or pick a statement and the
model orbits to its anchor, the map flies to its place, and the chronology
highlights its moment. That cross-surface synchrony is the tool.

## Consent and sovereignty by design

One boundary function (`publicClone`) produces every export and every published
view. It:

- drops restricted and embargoed statements;
- withholds statements carrying a restricting sovereignty label (community use
  only, withholding) while showing attribution labels as credit;
- aliases narrators whose identity is not public, and drops those left with no
  publishable statements;
- withholds a non-public model and strips its anchors from published statements;
- cites the recording by sha-256 rather than embedding the voice;
- withholds or coarsens coordinates marked not safe to publish;
- and reports all of it in an honest disclosure.

Sovereignty here is a **lean layer**: a rights-holder credit and a curated set of
labels a community may assign. The tool records and respects labels; it does not
mint official Local Contexts labels.

## Run it

```sh
npm install
npm run dev
```

It opens with a plainly fictional sample loaded. Everything runs in the browser:
the project and its media stay on your machine in IndexedDB, nothing is uploaded,
the 3D model loads from a local file, and the basemap fetches no tiles.

- **Publish** builds a self-contained, consent-cleared HTML investigation (and,
  via print CSS, a print dossier).
- **Export** / **Import** save and load the whole project as one file (the only
  unsanitized output, for your own keeping).

## Stack

React + TypeScript + Vite, MapLibre GL + deck.gl with PMTiles, react-three-fiber
+ drei (three.js), a visx timeline, Dexie (IndexedDB), Zustand, and WebCrypto
sha-256 for fixity. No accounts, no servers, no fees.

## Evidentiary discipline

Held files (the recording, the model) are hashed with sha-256 over their actual
bytes, in the Berkeley Protocol manner. For a recording referenced by link, an
archived snapshot is hashed, never the remote bytes.

## Licence

Source-available, not open source. The source code is under the
[PolyForm Noncommercial License 1.0.0](LICENSE); the non-code assets (the design,
this documentation, the bundled sample, and the investigations the tool produces)
are under [CC BY-NC-SA 4.0](LICENSE-ASSETS.md). Free to use, modify, and share for
any noncommercial purpose, including education, research, nonprofits, and
government. Commercial use is not granted here; contact the authors for commercial
licensing.

Parallax publishes these instruments for verifiability, not as products to adopt.

By Parallax Agency and Jeff O'Brien. Parallax is an independent, consent-first
research practice for art history and the archive, founded and directed by Jeff
O'Brien (Material / Image Research Lab, UC Santa Barbara).
