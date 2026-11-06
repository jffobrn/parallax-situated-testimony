import { useEffect, useMemo, useRef, useState } from 'react'
import { scaleTime } from '@visx/scale'
import { AxisBottom } from '@visx/axis'
import { Group } from '@visx/group'
import { useStore } from '../state/store'
import {
  activeStatementId,
  timeExtent,
  timelineItems,
  type TimelineItem,
} from '../lib/derive'
import { token, useTheme } from '../state/theme'

/** Timeline colours, read from the design tokens so both themes follow. */
function readPal() {
  return {
    axis: token('--text-3'),
    label: token('--text-2'),
    halo: token('--surface'),
    grid: token('--line-2'),
    window: token('--signal-wash'),
    windowLine: token('--signal-line'),
    public: token('--primary'),
    restricted: token('--alert'),
    embargoed: token('--alert'),
    sel: token('--mark'),
    brush: token('--signal-wash'),
    brushLine: token('--signal-line'),
  }
}
type Pal = ReturnType<typeof readPal>

const M = { top: 12, right: 18, bottom: 24, left: 18 }
const MONO = "'Plex Mono', ui-monospace, monospace"
const SANS = "'Archivo', sans-serif"

function itemColor(it: TimelineItem, PAL: Pal): string {
  return it.consent === 'embargoed'
    ? PAL.embargoed
    : it.consent === 'restricted'
      ? PAL.restricted
      : PAL.public
}

function fmtTick(d: Date, spanMs: number): string {
  const iso = d.toISOString()
  if (spanMs < 2 * 86_400_000) return iso.slice(11, 16)
  if (spanMs < 120 * 86_400_000) return iso.slice(5, 10)
  return iso.slice(0, 7)
}

/**
 * The chronology: every statement that refers to a real-world time, on one
 * brushable lane, coloured by consent, with uncertain times drawn as spans
 * rather than false points. Selecting here highlights the statement in the
 * transcript, the model, and the map; dragging filters to a window.
 */
export function Timeline() {
  const theme = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const PAL = useMemo(() => readPal(), [theme])
  const project = useStore((s) => s.project)
  const selectedStatementId = useStore((s) => s.selectedStatementId)
  const hoveredId = useStore((s) => s.hoveredId)
  const playheadSec = useStore((s) => s.playheadSec)
  const timeBrush = useStore((s) => s.timeBrush)

  const activeId = activeStatementId(project, playheadSec)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 600, h: 120 })

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const items = useMemo(() => timelineItems(project), [project])
  const extent = useMemo(() => timeExtent(project), [project])

  const innerW = Math.max(40, size.w - M.left - M.right)
  const innerH = Math.max(26, size.h - M.top - M.bottom)

  const domain = useMemo<[number, number]>(() => {
    if (!extent) return [0, 1]
    const [a, b] = extent
    const pad = Math.max((b - a) * 0.05, 60_000)
    return [a - pad, b + pad]
  }, [extent])

  const scale = useMemo(
    () => scaleTime({ domain: [new Date(domain[0]), new Date(domain[1])], range: [0, innerW] }),
    [domain, innerW],
  )

  const x = (ms: number) => scale(new Date(ms))
  const spanMs = domain[1] - domain[0]

  const laneH = Math.min(18, innerH - 12)
  const laneY = innerH * 0.55

  const inBrush = (it: TimelineItem) =>
    !timeBrush || (it.end >= timeBrush.start && it.start <= timeBrush.end)

  const drag = useRef<{ x0: number } | null>(null)
  const [dragNow, setDragNow] = useState<{ a: number; b: number } | null>(null)

  const localX = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return (rect ? clientX - rect.left : 0) - M.left
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const px = Math.max(0, Math.min(innerW, localX(e.clientX)))
    drag.current = { x0: px }
    setDragNow({ a: px, b: px })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const px = Math.max(0, Math.min(innerW, localX(e.clientX)))
    setDragNow({ a: Math.min(drag.current.x0, px), b: Math.max(drag.current.x0, px) })
  }
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return
    const px = Math.max(0, Math.min(innerW, localX(e.clientX)))
    const a = Math.min(drag.current.x0, px)
    const b = Math.max(drag.current.x0, px)
    if (b - a < 4) {
      useStore.getState().setTimeBrush(null)
    } else {
      useStore.getState().setTimeBrush({
        start: scale.invert(a).getTime(),
        end: scale.invert(b).getTime(),
      })
    }
    drag.current = null
    setDragNow(null)
  }

  if (!extent) {
    return (
      <div className="timeline-wrap" ref={wrapRef}>
        <div className="empty">No dated statements yet. Give a statement a "refers to" time to place it on the chronology.</div>
      </div>
    )
  }

  const win = project.testimony.window
  const winStart = win.start ? Date.parse(win.start) : NaN
  const winEnd = win.end ? Date.parse(win.end) : NaN

  return (
    <div className="timeline-wrap" ref={wrapRef}>
      <svg width={size.w} height={size.h} style={{ display: 'block' }}>
        <Group left={M.left} top={M.top}>
          {!Number.isNaN(winStart) && !Number.isNaN(winEnd) && (
            <rect
              x={x(winStart)}
              y={0}
              width={Math.max(1, x(winEnd) - x(winStart))}
              height={innerH}
              fill={PAL.window}
              stroke={PAL.windowLine}
            />
          )}

          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            style={{ cursor: 'crosshair' }}
          />

          {items.map((it) => {
            const x0 = x(it.start)
            const x1 = x(it.end)
            const w = Math.max(0, x1 - x0)
            const col = itemColor(it, PAL)
            const active = it.id === selectedStatementId || it.id === hoveredId || it.id === activeId
            const dim = !inBrush(it)
            const isPoint = w < 2

            return (
              <g
                key={it.id}
                style={{ cursor: 'pointer', opacity: dim ? 0.32 : 1 }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  useStore.getState().selectStatement(it.id)
                }}
                onPointerEnter={() => useStore.getState().hover(it.id)}
                onPointerLeave={() => useStore.getState().hover(null)}
              >
                {isPoint ? (
                  <>
                    <line
                      x1={x0}
                      x2={x0}
                      y1={laneY - laneH / 2 - 3}
                      y2={laneY + laneH / 2 + 3}
                      stroke={col}
                      strokeWidth={active ? 2.5 : 1.5}
                    />
                    <circle cx={x0} cy={laneY - laneH / 2 - 5} r={active ? 3.5 : 2.5} fill={col} />
                  </>
                ) : (
                  <rect
                    x={x0}
                    y={laneY - laneH / 2}
                    width={w}
                    height={laneH}
                    rx={2}
                    fill={col}
                    fillOpacity={0.32}
                    stroke={active ? PAL.sel : col}
                    strokeWidth={active ? 1.8 : 1}
                  />
                )}
              </g>
            )
          })}

          {/* The lane name sits at the top of the plot, clear of the marks, with a
              halo so a mark never hides it. */}
          <text
            x={0}
            y={10}
            fill={PAL.label}
            fontSize={12}
            fontFamily={SANS}
            stroke={PAL.halo}
            strokeWidth={4}
            paintOrder="stroke"
            pointerEvents="none"
          >
            Statements
          </text>

          {(() => {
            const band = dragNow ?? (timeBrush ? { a: x(timeBrush.start), b: x(timeBrush.end) } : null)
            if (!band) return null
            return (
              <rect
                x={band.a}
                y={0}
                width={Math.max(1, band.b - band.a)}
                height={innerH}
                fill={PAL.brush}
                stroke={PAL.brushLine}
                pointerEvents="none"
              />
            )
          })()}

          <AxisBottom
            top={innerH}
            scale={scale}
            numTicks={6}
            stroke={PAL.grid}
            tickStroke={PAL.grid}
            tickFormat={(v) => fmtTick(v as Date, spanMs)}
            tickLabelProps={() => ({
              fill: PAL.axis,
              fontSize: 11,
              fontFamily: MONO,
              textAnchor: 'middle',
              dy: '0.2em',
            })}
          />
        </Group>
      </svg>
    </div>
  )
}
