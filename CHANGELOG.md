# Changelog

All notable changes to Situated Testimony are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses semantic
versioning.

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
