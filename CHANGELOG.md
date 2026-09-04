# Changelog

All notable changes to Situated Testimony are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses semantic
versioning.

## [1.3.1] - 2026-09-04

### Fixed

- The place-label overlay no longer loads over the File basemap. A local
  `.pmtiles` ground promises that nothing is fetched, but with Labels switched
  on it still pulled label tiles from an online host, disclosing the viewed
  area. The overlay now applies only to the online grounds, so the offline
  grounds keep their promise unconditionally, whatever the toggle says.
- The app's own version constant (written into exported project files) had
  fallen behind the release version; it is now synced.

## [1.3.0] - 2026-09-04

The four feature commits of 2026-07-10, released and documented together with a
browser-verification pass.

### Added

- A retrievable basemap in the Map view: Esri World Imagery (satellite,
  tokenless) is the default ground, with OpenStreetMap streets, Esri topographic,
  the offline coordinate grid, and a local .pmtiles file as alternatives, plus a
  place-label overlay.
- Dated imagery: with satellite active, an Imagery menu switches from the live
  mosaic to a dated release of the Esri World Imagery Wayback archive, so a
  testimony can be read against imagery near its own moment.
- Place search on the map: a typed coordinate resolves locally; a place name
  queries the Nominatim geocoder, and picking a result flies the map there.
- A measure tool on the map: a clicked path reads out its distance in metres, and
  a closed figure adds its area. A reading aid, not saved to the project.
- Transcript import: an SRT or VTT file becomes statements with their clip times
  set, and a plain-text file becomes one statement per paragraph. Imported
  statements arrive public, marked probable, and attributed to the first
  narrator.
- The scene model can load from a URL (a glTF/glb the host serves cross-origin),
  as an alternative to a local file; only the URL is stored.
- 3D viewpoint bookmarks: a statement can capture the model camera's pose, and
  selecting the statement then flies the camera to that saved framing before
  releasing it.

### Fixed

- The model-from-URL field's hint claimed nothing is downloaded; it now says what
  happens (the file is fetched to display, and only the URL is stored).
- The README and the researcher's guide still described the pre-1.3 posture (no
  map service called, a synthetic basemap only). Both now state the actual
  retrieval surface and what each request discloses: tile coordinates to the
  tile host, search text to the geocoder, never testimony data. The guide gains a
  section covering the basemap picker, dated imagery, search, measure, transcript
  import, model-from-URL, and viewpoint bookmarks.

## [1.2.1] - 2026-06-23

### Added

- The narrator and statement rows in the rail are keyboard accessible: each is now
  a focusable button that activates on Enter or Space, with the standard focus
  ring, so the testimony can be navigated without a mouse. A narrator row's filter
  button keeps its own behaviour.

### Fixed

- Readout counts read in the singular when there is one (1 statement, not
  1 statements).

## [1.2.0] - 2026-06-23

### Added

- A New action that starts an empty testimony, alongside Reset. Both now confirm
  in two steps in the toolbar rather than through a browser dialog, so the action
  still works (and reports its outcome) in installed PWAs, which suppress
  window.confirm.

### Fixed

- The toolbar no longer overflows its single row at narrow window widths. The
  action buttons previously wrapped into a vertical stack that spilled beneath
  the bar, where the rail card painted over them and swallowed clicks, so Reset
  and the other actions silently did nothing. They are now held on one row.
- Resetting to the sample immediately after an edit could be undone by a pending
  debounced save; that save is now cancelled before the reset writes.

## [1.1.1] - 2026-06-22

### Changed

- Removed `CITATION.cff`: these tools are published for verifiability as part of
  Parallax, not packaged for reuse, so they carry no citation metadata.
- Rebalanced the README to lead with the method; consent is kept as one feature
  (the publish boundary) rather than the headline of every section.

### Fixed

- Chronology: the lane label no longer overlaps the leftmost statement marks when
  dates cluster against the left edge.

## [1.1.0] - 2026-06-20

### Changed

- Relicensed from MIT to a dual noncommercial licence: the source code is now
  under the PolyForm Noncommercial License 1.0.0 and the non-code assets under
  CC BY-NC-SA 4.0. The project is source-available, not open source; commercial
  use is not granted. Versions released under MIT remain available under MIT.
- Attribution updated to Parallax Agency and Jeff O'Brien.

## [1.0.0] - 2026-06-19

First release. The third tool of the Parallax suite.

### Added

- **Testimony as time-coded statements.** An account modelled as a sequence of
  statements, each with its words (multilingual, RTL-aware), an optional clip into
  the recording, the real-world time it refers to, an anchor, a certainty, and its
  own consent and sovereignty.
- **Three readings of one account.** A Transcript spine, a 3D Model view
  (react-three-fiber, a loaded glTF or a procedural massing), and a tokenless Map,
  linked to a chronology and a recording transport. Scrub the recording or pick a
  statement and every surface follows.
- **Consent and sovereignty boundary.** One `publicClone` function produces every
  export and published view: it drops restricted and embargoed statements, enforces
  community-use and withholding labels, aliases protected narrators, withholds a
  non-public model, cites the recording by hash rather than embedding the voice,
  and withholds or coarsens unsafe coordinates, with an honest disclosure.
- **Lean sovereignty layer.** A rights-holder credit and a curated set of labels a
  community may assign, recorded and respected, not minted.
- **Evidentiary discipline.** sha-256 fixity over held bytes; archived snapshots
  hashed for linked recordings.
- **Local-first.** The project and media live in IndexedDB; nothing is uploaded.
  Full project export and import as one file.
- **Publish.** A self-contained, consent-cleared HTML investigation, and a print
  dossier via print CSS.
- A plainly fictional sample testimony that exercises every feature.
