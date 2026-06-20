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
  witness: 'witness',
  survivor: 'survivor',
  artist: 'artist',
  elder: 'elder',
  family: 'family',
  expert: 'expert',
  official: 'official',
  other: 'narrator',
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
  return `<div class="labels">${labels
    .map((l) => `<span class="lbl" title="${esc(l.note)}">${esc(l.text)}</span>`)
    .join('')}</div>`
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
  if (st.anchor?.model) parts.push('anchored in the model')
  if (st.anchor?.geo) {
    const g = st.anchor.geo
    parts.push(`${formatLatLng(g.lat, g.lng)}${g.coarsened ? ' (approx)' : ''}`)
  }
  return parts.join(' / ')
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
            <span class="st-cert">${esc(st.certainty)}</span>
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
  rows.push(`<dt>title</dt><dd${dirAttr(m.title)}>${esc(m.title)}</dd>`)
  rows.push(`<dt>kind</dt><dd>${esc(m.kind)}</dd>`)
  if (m.file) {
    rows.push(`<dt>sha-256</dt><dd class="hash">${esc(m.file.sha256)}</dd>`)
  } else {
    rows.push(`<dt>scene</dt><dd>procedural massing</dd>`)
  }
  rows.push(`<dt>anchored</dt><dd>${anchored} statement${anchored === 1 ? '' : 's'}</dd>`)
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
  rows.push(`<dt>medium</dt><dd>${esc(r.medium)}</dd>`)
  rows.push(`<dt>title</dt><dd${dirAttr(r.title)}>${esc(r.title)}</dd>`)
  if (r.durationSec) rows.push(`<dt>length</dt><dd>${esc(fmtClock(r.durationSec))}</dd>`)
  if (r.recordedOn) rows.push(`<dt>recorded</dt><dd>${esc(formatDateTime(r.recordedOn.value, r.recordedOn.precision))}</dd>`)
  if (r.file) rows.push(`<dt>sha-256</dt><dd class="hash">${esc(r.file.sha256)}</dd>`)
  if (r.link) {
    rows.push(`<dt>link</dt><dd class="hash">${esc(r.link.url)}</dd>`)
    if (r.link.archivedSha256) rows.push(`<dt>snapshot</dt><dd class="hash">sha256:${esc(r.link.archivedSha256)}</dd>`)
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
<header class="head">
  <div class="kicker">CONSENT-CLEARED TESTIMONY</div>
  ${titlesHtml}
  <div class="head-meta">
    <span class="tag">testimony of ${esc(SUBJECT_ARTICLE[t.subject] ?? t.subject)}</span>
    <span class="mono">${esc(windowStr)}</span>
    ${t.place?.name ? `<span class="mono">${esc(t.place.name)}</span>` : ''}
    <span class="mono">${pub.statements.length} statements / ${t.narrators.length} narrators</span>
  </div>
  ${t.rightsHolder ? `<div class="rights mono">Rights held by ${esc(t.rightsHolder)}</div>` : ''}
  ${labelChips(t.labels)}
  ${t.summary ? `<p class="summary"${dirAttr(t.summary)}>${esc(t.summary)}</p>` : ''}
</header>

${buildNarrators(pub)}

${buildTranscript(pub)}

${
  hasGeoPoints
    ? `<section class="block">
  <h2 class="block-label">Ground anchors</h2>
  ${buildSvgMap(pub)}
  <div class="legend mono">
    <span><i class="sw sw-anchor"></i>statement anchor</span>
    <span><i class="sw sw-place"></i>testimony place</span>
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
  <p class="mono">Produced with ${esc(APP_NAME)} (${esc(SUITE_NAME)}) by ${esc(AUTHOR.name)}, ${esc(AUTHOR.affiliation)}. ${generated ? 'Generated ' + generated + '.' : ''}</p>
</footer>

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
:root{--bg:#07090c;--bg1:#0c0f14;--bg2:#11151c;--line:#1b212b;--line2:#27303c;--text:#e7ebf0;--t2:#a7b0bd;--t3:#6f7989;--signal:#f3a93c;--signalb:#ffc163;--subject:#7fa8bf;--alert:#e5544b;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Archivo',system-ui,sans-serif;line-height:1.55;padding:40px 24px 80px;max-width:1000px;margin:0 auto;font-size:14px}
.mono,.hash,.chrono-time,.head-meta .mono{font-family:'Spline Sans Mono',ui-monospace,monospace}
[dir=rtl]{font-family:'Noto Naskh Arabic','Archivo',serif}
.kicker{font-family:'Spline Sans Mono',monospace;font-size:11px;letter-spacing:.18em;color:var(--signal);margin-bottom:10px}
.title{font-size:30px;line-height:1.15;font-weight:600;margin-bottom:4px}
.title-alt{font-size:20px;font-weight:500;color:var(--t2);margin-bottom:4px}
.head{border-bottom:1px solid var(--line2);padding-bottom:20px;margin-bottom:28px}
.head-meta{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0;color:var(--t3);font-size:12px;align-items:center}
.tag{border:1px solid var(--line2);border-radius:2px;padding:2px 8px;font-family:'Spline Sans Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2)}
.rights{font-size:12px;color:var(--t2);margin-bottom:8px}
.summary{color:var(--t2);max-width:74ch;margin-top:8px}
.labels{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.lbl{font-family:'Spline Sans Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--signalb);border:1px solid var(--signal);border-radius:9px;padding:1px 8px}
.block{margin:34px 0}
.block-label{font-family:'Spline Sans Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:16px;font-weight:500}
.narrators{list-style:none;display:flex;flex-direction:column;gap:6px}
.narrators li{display:flex;gap:10px;align-items:baseline;font-size:14px;padding:5px 0;border-bottom:1px solid var(--line)}
.nar-name{font-weight:600}
.nar-alias{font-family:'Spline Sans Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--signal);border:1px solid var(--signal);border-radius:9px;padding:0 6px}
.nar-meta{color:var(--t3);font-size:12px}
.transcript{display:flex;flex-direction:column;gap:2px}
.st{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px 8px;border-radius:4px;border:1px solid transparent}
.st.hi{border-color:var(--signal);background:var(--bg1)}
.st-gutter{text-align:right}
.st-time{font-family:'Spline Sans Mono',monospace;font-size:11px;color:var(--signal)}
.st-meta{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px}
.st-narrator{font-weight:600;font-size:13px}
.st-cert{font-family:'Spline Sans Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}
.st-refers{font-family:'Spline Sans Mono',monospace;font-size:10px;color:var(--t3)}
.st-text{font-size:15px;line-height:1.6;color:var(--text);max-width:72ch}
.st-anchor{font-size:10px;color:var(--t3);margin-top:6px}
.sitemap{width:100%;height:auto;background:var(--bg1);border:1px solid var(--line2);border-radius:4px}
.m-frame{fill:none;stroke:var(--line2)}
.m-grid{stroke:var(--line);stroke-width:1}
.marker{stroke:#0a0c10;stroke-width:1.5}
.m-anchor{fill:var(--subject)}
.m-place{fill:none;stroke:var(--t2);stroke-width:1.5}
.marker.hi{stroke:var(--signalb);stroke-width:2.5;fill:var(--signalb)}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;color:var(--t3);font-size:11px}
.legend i{display:inline-block;width:9px;height:9px;margin-right:5px;vertical-align:middle;border-radius:50%}
.sw-anchor{background:var(--subject)}.sw-place{background:transparent;border:1.5px solid var(--t2)}
.meta{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px;max-width:72ch}
.meta dt{font-family:'Spline Sans Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding-top:2px}
.hash{font-family:'Spline Sans Mono',monospace;font-size:10px;color:var(--t3);word-break:break-all}
.chrono{list-style:none}
.chrono li{display:flex;gap:14px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line)}
.chrono-time{color:var(--signal);min-width:170px;font-size:12px}
.chrono-label{flex:1}
.disclosure{background:var(--bg1);border:1px solid var(--line2);border-radius:4px;padding:16px}
.redactions{margin-top:8px;padding-left:18px;color:var(--t2);font-size:13px}
.muted{color:var(--t3);margin-top:10px;font-size:13px}
.foot{margin-top:48px;border-top:1px solid var(--line2);padding-top:18px;color:var(--t3);font-size:12px}
.disclaimer{color:var(--t2);margin-bottom:8px;max-width:74ch}
@media print{
  body{background:#fff;color:#111;max-width:none;padding:0}
  .kicker{color:#7a5300}.title-alt,.summary,.disclaimer,.muted,.st-text{color:#222}
  .sitemap{background:#fff;border-color:#bbb}.m-grid{stroke:#eee}.m-frame{stroke:#ccc}
  .m-anchor{fill:#3a6e8c}.m-place{stroke:#555}
  .st.hi{border-color:#ccc;background:#f6f6f6}
  .disclosure{background:#fff;border-color:#ccc}
  .block-label,.st-cert,.meta dt,.hash,.chrono-time{color:#555}
  .st-time,.nar-alias{color:#7a5300}
  .lbl{color:#7a5300;border-color:#caa24a}
  .tag{color:#333;border-color:#bbb}
  a,script{display:initial}
}
`
