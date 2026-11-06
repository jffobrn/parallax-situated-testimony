/**
 * Build the published testimony: one self-contained, static HTML file presenting
 * the account as the suite's "forum". It takes a PublicProject (already through
 * the consent boundary) and never reaches back to the full project, so nothing
 * sensitive can appear here. It renders the narrators (named or aliased), the
 * transcript with its time-codes and anchors, a site map of the ground anchors,
 * the model cited by hash, a chronology, the recording cited by hash, and the
 * consent and sovereignty disclosure. The same file is the screen artifact and,
 * via print CSS, a print dossier.
 */

import archivo400 from '../design/fonts/archivo-400.woff2?inline'
import archivo600 from '../design/fonts/archivo-600.woff2?inline'
import {
  APP_NAME,
  AUTHOR,
  DISCLAIMER,
  SUITE_NAME,
  dirOf,
  formatDateTime,
  formatLatLng,
  redactionLines,
  toLocal,
  type LatLng,
  type NarratorRole,
  type PublicLabel,
  type PublicProject,
  type PublicStatement,
} from '../core'

const ROLE_LABEL: Record<NarratorRole, string> = {
  witness: 'Witness',
  survivor: 'Survivor',
  artist: 'Artist',
  elder: 'Elder',
  family: 'Family member',
  expert: 'Expert',
  official: 'Official',
  other: 'Narrator',
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

const SUBJECT_ARTICLE: Record<string, string> = {
  event: 'an event',
  place: 'a place',
  work: 'a work',
  life: 'a life',
  practice: 'a practice',
}

function esc(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dirAttr(s: string): string {
  return ` dir="${dirOf(s)}"`
}

function fmtClock(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return ''
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function labelChips(labels: PublicLabel[]): string {
  if (!labels.length) return ''
  return `<p class="labels">Labels: ${labels
    .map((l) => `<span class="lbl" title="${esc(l.note)}">${esc(l.text)}</span>`)
    .join(', ')}</p>`
}

// --- Narrators -------------------------------------------------------------

function buildNarrators(pub: PublicProject): string {
  if (pub.testimony.narrators.length === 0) return ''
  const rows = pub.testimony.narrators
    .map((n) => {
      const meta = [ROLE_LABEL[n.role], n.affiliation].filter(Boolean).join(', ')
      return `<li><span class="nar-name"${dirAttr(n.name)}>${esc(n.name)}</span>${
        n.aliased ? '<span class="nar-alias">alias</span>' : ''
      }<span class="nar-meta">${esc(meta)}</span></li>`
    })
    .join('')
  return `<section class="block">
    <h2 class="block-label">Narrators</h2>
    <ul class="narrators">${rows}</ul>
  </section>`
}

// --- Transcript ------------------------------------------------------------

function anchorNote(st: PublicStatement): string {
  const parts: string[] = []
  if (st.anchor?.model) parts.push('Anchored in the model')
  if (st.anchor?.geo) {
    const g = st.anchor.geo
    parts.push(`on the map at ${formatLatLng(g.lat, g.lng)}${g.coarsened ? ' (approximate)' : ''}`)
  }
  if (parts.length === 1 && parts[0].startsWith('on the map')) return cap(`anchored ${parts[0]}`)
  return parts.join(' and ')
}

function buildTranscript(pub: PublicProject): string {
  if (pub.statements.length === 0) {
    return '<section class="block"><h2 class="block-label">Transcript</h2><p class="muted">No publishable statements.</p></section>'
  }
  const narratorName = new Map(pub.testimony.narrators.map((n) => [n.id, n.name]))
  const blocks = pub.statements
    .map((st) => {
      const name = st.narratorId ? narratorName.get(st.narratorId) : undefined
      const time = st.clip ? fmtClock(st.clip.startSec) : ''
      const refers = st.refersTo ? formatDateTime(st.refersTo.value, st.refersTo.precision) : ''
      const text = st.text[0]?.text ?? ''
      const note = anchorNote(st)
      return `<article class="st" data-ex="${esc(st.id)}" data-id="${esc(st.id)}">
        <div class="st-gutter"><span class="st-time">${esc(time)}</span></div>
        <div class="st-body">
          <div class="st-meta">
            ${name ? `<span class="st-narrator"${dirAttr(name)}>${esc(name)}</span>` : ''}
            <span class="st-cert">${esc(cap(st.certainty))}</span>
            ${refers ? `<span class="st-refers">${esc(refers)}</span>` : ''}
          </div>
          <p class="st-text"${dirAttr(text)}>${esc(text)}</p>
          ${note ? `<div class="st-anchor mono">${esc(note)}</div>` : ''}
          ${labelChips(st.labels)}
        </div>
      </article>`
    })
    .join('')
  return `<section class="block">
    <h2 class="block-label">Transcript</h2>
    <div class="transcript">${blocks}</div>
  </section>`
}

// --- Site map (ground anchors) ---------------------------------------------

interface MapPoint {
  id?: string
  kind: 'place' | 'anchor'
  lat: number
  lng: number
  coarsened?: boolean
}

function collectPoints(pub: PublicProject): MapPoint[] {
  const pts: MapPoint[] = []
  if (pub.testimony.place)
    pts.push({
      kind: 'place',
      lat: pub.testimony.place.lat,
      lng: pub.testimony.place.lng,
      coarsened: pub.testimony.place.coarsened,
    })
  for (const st of pub.statements) {
    if (st.anchor?.geo)
      pts.push({
        id: st.id,
        kind: 'anchor',
        lat: st.anchor.geo.lat,
        lng: st.anchor.geo.lng,
        coarsened: st.anchor.geo.coarsened,
      })
  }
  return pts
}

function buildSvgMap(pub: PublicProject): string {
  const pts = collectPoints(pub)
  if (pts.length === 0) return ''
  const W = 820
  const H = 440
  const pad = 48
  const ref: LatLng = pub.testimony.place ?? { lat: pts[0].lat, lng: pts[0].lng }
  const local = pts.map((p) => ({ p, xy: toLocal(ref, p) }))

  let minX = Math.min(...local.map((l) => l.xy.x))
  let maxX = Math.max(...local.map((l) => l.xy.x))
  let minY = Math.min(...local.map((l) => l.xy.y))
  let maxY = Math.max(...local.map((l) => l.xy.y))
  let spanX = maxX - minX
  let spanY = maxY - minY
  if (spanX < 120) { const c = (minX + maxX) / 2; minX = c - 60; maxX = c + 60; spanX = 120 }
  if (spanY < 120) { const c = (minY + maxY) / 2; minY = c - 60; maxY = c + 60; spanY = 120 }
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  const X = (x: number) => pad + (x - minX) * scale
  const Y = (y: number) => H - (pad + (y - minY) * scale)
  const proj = (lat: number, lng: number) => {
    const xy = toLocal(ref, { lat, lng })
    return { x: X(xy.x), y: Y(xy.y) }
  }

  const parts: string[] = []
  parts.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" class="m-frame"/>`)
  for (let i = 1; i < 6; i++) {
    const gx = pad + ((W - 2 * pad) * i) / 6
    const gy = pad + ((H - 2 * pad) * i) / 6
    parts.push(`<line x1="${gx.toFixed(1)}" y1="${pad}" x2="${gx.toFixed(1)}" y2="${H - pad}" class="m-grid"/>`)
    parts.push(`<line x1="${pad}" y1="${gy.toFixed(1)}" x2="${W - pad}" y2="${gy.toFixed(1)}" class="m-grid"/>`)
  }
  for (const p of pts) {
    const c = proj(p.lat, p.lng)
    const cx = c.x.toFixed(1)
    const cy = c.y.toFixed(1)
    if (p.kind === 'place') {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="8" class="m-place"/>`)
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="5" class="marker m-anchor" data-ex="${esc(p.id)}" data-id="${esc(p.id)}"/>`)
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="sitemap" role="img" aria-label="Ground anchors">${parts.join('')}</svg>`
}

// --- Model and recording ---------------------------------------------------

function buildModel(pub: PublicProject): string {
  const m = pub.testimony.model
  if (!m) return ''
  const anchored = pub.statements.filter((s) => s.anchor?.model).length
  const rows: string[] = []
  rows.push(`<dt>Title</dt><dd${dirAttr(m.title)}>${esc(m.title)}</dd>`)
  rows.push(`<dt>Kind</dt><dd>${m.kind === 'gltf' ? 'glTF model' : 'Procedural massing'}</dd>`)
  if (m.file) {
    rows.push(`<dt>SHA-256</dt><dd class="hash">${esc(m.file.sha256)}</dd>`)
  } else {
    rows.push(`<dt>Scene</dt><dd>Procedural massing</dd>`)
  }
  rows.push(`<dt>Anchored</dt><dd>${anchored} statement${anchored === 1 ? '' : 's'}</dd>`)
  return `<section class="block">
    <h2 class="block-label">Model</h2>
    <dl class="meta">${rows.join('')}</dl>
    <p class="muted">The 3D scene is explored in the interactive ${esc(APP_NAME)} app; here it is cited for the record.</p>
  </section>`
}

function buildRecording(pub: PublicProject): string {
  const r = pub.testimony.recording
  if (!r) return ''
  const rows: string[] = []
  rows.push(`<dt>Medium</dt><dd>${esc(cap(r.medium.replace(/-/g, ' ')))}</dd>`)
  rows.push(`<dt>Title</dt><dd${dirAttr(r.title)}>${esc(r.title)}</dd>`)
  if (r.durationSec) rows.push(`<dt>Length</dt><dd class="mono">${esc(fmtClock(r.durationSec))}</dd>`)
  if (r.recordedOn) rows.push(`<dt>Recorded</dt><dd class="mono">${esc(formatDateTime(r.recordedOn.value, r.recordedOn.precision))}</dd>`)
  if (r.file) rows.push(`<dt>SHA-256</dt><dd class="hash">${esc(r.file.sha256)}</dd>`)
  if (r.link) {
    rows.push(`<dt>Link</dt><dd class="hash">${esc(r.link.url)}</dd>`)
    if (r.link.archivedSha256) rows.push(`<dt>Snapshot</dt><dd class="hash">sha256:${esc(r.link.archivedSha256)}</dd>`)
  }
  return `<section class="block">
    <h2 class="block-label">Recording</h2>
    <dl class="meta">${rows.join('')}</dl>
    <p class="muted">Recording media is cited by hash, not embedded, to protect the voice.</p>
  </section>`
}

// --- Chronology ------------------------------------------------------------

function buildChronology(pub: PublicProject): string {
  interface Row { sort: number; time: string; label: string; dir: string }
  const rows: Row[] = []
  for (const st of pub.statements) {
    if (!st.refersTo) continue
    const t = Date.parse(st.refersTo.value)
    const text = st.text[0]?.text ?? ''
    rows.push({
      sort: Number.isNaN(t) ? 0 : t,
      time: formatDateTime(st.refersTo.value, st.refersTo.precision),
      label: text.length > 90 ? text.slice(0, 89) + '…' : text,
      dir: dirOf(text),
    })
  }
  rows.sort((a, b) => a.sort - b.sort)
  if (rows.length === 0) return ''
  return `<section class="block">
    <h2 class="block-label">Chronology</h2>
    <ol class="chrono">${rows
      .map(
        (r) =>
          `<li><span class="chrono-time">${esc(r.time)}</span><span class="chrono-label" dir="${r.dir}">${esc(r.label)}</span></li>`,
      )
      .join('')}</ol>
  </section>`
}

// --- Document --------------------------------------------------------------

export function buildPublishedHtml(pub: PublicProject): string {
  const t = pub.testimony
  const title = t.titles[0]?.text ?? 'Testimony'
  const titlesHtml = t.titles
    .map((tt, i) => `<h1 class="${i === 0 ? 'title' : 'title-alt'}"${dirAttr(tt.text)}>${esc(tt.text)}</h1>`)
    .join('')

  const windowStr =
    t.window.start || t.window.end
      ? `${t.window.start ? formatDateTime(t.window.start, t.window.precision) : '?'} to ${t.window.end ? formatDateTime(t.window.end, t.window.precision) : '?'}`
      : 'time window not set'

  const redactions = redactionLines(pub.redactions).map((l) => `<li>${esc(l)}</li>`).join('')
  const generated = pub.generatedAt ? esc(pub.generatedAt) : ''
  const hasGeoPoints = collectPoints(pub).length > 0

  return `<!doctype html>
<html lang="${dirOf(title) === 'rtl' ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>${PUBLISHED_CSS}</style>
</head>
<body>
<header class="head"><div class="head-inner">
  <div class="kicker">A consent-cleared testimony</div>
  ${titlesHtml}
  <div class="head-meta">
    <span class="tag">Testimony of ${esc(SUBJECT_ARTICLE[t.subject] ?? t.subject)}</span>
    <span class="mono">${esc(windowStr)}</span>
    ${t.place?.name ? `<span>${esc(t.place.name)}</span>` : ''}
    <span>${pub.statements.length} statement${pub.statements.length === 1 ? '' : 's'}, ${t.narrators.length} narrator${t.narrators.length === 1 ? '' : 's'}</span>
  </div>
  ${t.rightsHolder ? `<div class="rights">Rights held by ${esc(t.rightsHolder)}</div>` : ''}
  ${labelChips(t.labels)}
  ${t.summary ? `<p class="summary"${dirAttr(t.summary)}>${esc(t.summary)}</p>` : ''}
</div></header>
<main class="page">

${buildNarrators(pub)}

${buildTranscript(pub)}

${
  hasGeoPoints
    ? `<section class="block">
  <h2 class="block-label">Ground anchors</h2>
  ${buildSvgMap(pub)}
  <div class="legend">
    <span><i class="sw sw-anchor"></i>Statement anchor</span>
    <span><i class="sw sw-place"></i>Testimony place</span>
  </div>
</section>`
    : ''
}

${buildModel(pub)}

${buildRecording(pub)}

${buildChronology(pub)}

<section class="block disclosure">
  <h2 class="block-label">Consent and sovereignty disclosure</h2>
  <p>This testimony passed through the ${esc(APP_NAME)} consent boundary before publication.</p>
  <ul class="redactions">${redactions}</ul>
</section>

<footer class="foot">
  <p class="disclaimer">${esc(DISCLAIMER)}</p>
  <p>Produced with ${esc(APP_NAME)} (${esc(SUITE_NAME)}) by ${esc(AUTHOR.name)}, ${esc(AUTHOR.affiliation)}. ${generated ? 'Generated <span class="mono">' + generated + '</span>.' : ''}</p>
</footer>
</main>

<script>
(function(){
  function all(id){return document.querySelectorAll('[data-id="'+id+'"]')}
  document.querySelectorAll('[data-ex]').forEach(function(n){
    var id=n.getAttribute('data-ex'); if(!id) return;
    n.addEventListener('mouseenter',function(){all(id).forEach(function(e){e.classList.add('hi')})});
    n.addEventListener('mouseleave',function(){all(id).forEach(function(e){e.classList.remove('hi')})});
  });
})();
</script>
</body>
</html>`
}

const PUBLISHED_CSS = `
@font-face{font-family:'Archivo';src:url(${archivo400}) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Archivo';src:url(${archivo600}) format('woff2');font-weight:600 700;font-display:swap}
:root{--violet:#5a1666;--mark:#c2185b;--ink:#1b1a18;--t2:#4a4842;--t3:#66635b;--line:#e1ded6;--line2:#cfccc3;--paper:#ffffff;--paper2:#f3f2ee;--alert:#b3261e;--subject:#5a1666}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:'Archivo','Helvetica Neue',Arial,sans-serif;line-height:1.55;font-size:15px}
.page{max-width:1000px;margin:0 auto;padding:0 24px 80px}
.mono,.hash,.chrono-time,.st-time,.head-meta .mono{font-family:'SF Mono',Menlo,Consolas,ui-monospace,monospace;font-size:.9em}
[dir=rtl]{font-family:'Noto Naskh Arabic','Archivo',serif}
.head{border-bottom:1px solid var(--line2);background:var(--paper2);margin-bottom:28px;padding:32px 24px 24px}
.head-inner{max-width:952px;margin:0 auto}
.kicker{font-size:13px;color:var(--t3);margin-bottom:8px}
.title{font-size:30px;line-height:1.15;font-weight:700;margin-bottom:6px}
.title-alt{font-size:20px;font-weight:400;color:var(--t2);margin-bottom:4px}
.head-meta{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0 0;color:var(--t2);font-size:14px;align-items:center}
.tag{border:1px solid var(--line2);background:var(--paper);border-radius:3px;padding:0 7px;font-size:13px;color:var(--t2)}
.rights{font-size:14px;color:var(--t2);margin-top:8px}
.summary{color:var(--t2);max-width:74ch;margin-top:10px}
.labels{margin-top:8px;font-size:14px;color:var(--t2)}
.lbl{color:var(--ink);font-weight:600}
.block{margin:36px 0}
.block-label{font-size:18px;font-weight:700;color:var(--ink);border-bottom:1px solid var(--line2);padding-bottom:6px;margin-bottom:16px}
.narrators{list-style:none}
.narrators li{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid var(--line)}
.nar-name{font-weight:600}
.nar-alias{font-size:13px;color:var(--t3)}
.nar-alias::before{content:'('}.nar-alias::after{content:')'}
.nar-meta{color:var(--t2);font-size:14px}
.transcript{display:flex;flex-direction:column}
.st{display:grid;grid-template-columns:64px 1fr;gap:14px;padding:12px 8px 12px 0;border-bottom:1px solid var(--line)}
.st.hi{background:var(--paper2);box-shadow:inset 3px 0 0 var(--violet)}
.st-gutter{text-align:right}
.st-time{color:var(--t2)}
.st-meta{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px;font-size:13px;color:var(--t3)}
.st-narrator{font-weight:600;font-size:14px;color:var(--ink)}
.st-cert{color:var(--t2)}
.st-text{font-size:16px;line-height:1.6;color:var(--ink);max-width:72ch}
.st-anchor{font-size:13px;color:var(--t3);margin-top:6px;font-family:inherit}
.sitemap{width:100%;height:auto;background:var(--paper2);border:1px solid var(--line2);border-radius:4px}
.m-frame{fill:none;stroke:var(--line2)}
.m-grid{stroke:var(--line);stroke-width:1}
.marker{stroke:#fff;stroke-width:1.5}
.m-anchor{fill:var(--subject)}
.m-place{fill:none;stroke:var(--t2);stroke-width:1.5}
.marker.hi{fill:var(--mark);stroke:#fff;stroke-width:2}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;color:var(--t2);font-size:13px}
.legend i{display:inline-block;width:9px;height:9px;margin-right:6px;vertical-align:middle;border-radius:50%}
.sw-anchor{background:var(--subject)}.sw-place{background:transparent;border:1.5px solid var(--t2)}
.meta{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:14px;max-width:72ch}
.meta dt{color:var(--t3)}
.hash{font-size:12px;color:var(--t2);word-break:break-all}
.chrono{list-style:none}
.chrono li{display:flex;gap:16px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.chrono-time{color:var(--ink);min-width:170px}
.chrono-label{flex:1}
.disclosure{background:var(--paper2);border:1px solid var(--line2);border-left:3px solid var(--violet);padding:14px 16px}
.redactions{margin-top:8px;padding-left:18px;color:var(--t2);font-size:14px}
.muted{color:var(--t3);margin-top:10px;font-size:14px}
.foot{margin-top:52px;border-top:1px solid var(--line2);padding-top:16px;color:var(--t3);font-size:13px}
.disclaimer{color:var(--t2);margin-bottom:8px;max-width:74ch}
a{color:inherit;text-decoration-color:var(--line2);text-underline-offset:3px}
a:hover{color:var(--violet);text-decoration-color:currentColor}
@media print{
  .head{background:none;padding:0 0 14px}
  .st,.disclosure,.narrators li{break-inside:avoid}
  a,script{display:initial}
}
`
