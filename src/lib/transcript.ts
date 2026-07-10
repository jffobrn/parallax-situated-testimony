/**
 * Transcript import (Situated Testimony): parse SubRip (.srt), WebVTT (.vtt), and
 * plain text into timed cues, so a recorded testimony's transcript can be brought
 * in and anchored to the recording rather than retyped. Self-contained and
 * dependency-free; runs locally over a dropped file.
 *
 * SRT uses "00:01:02,500 --> 00:01:05,000" (comma); VTT uses a dot and a leading
 * "WEBVTT" header; plain text becomes untimed cues split on blank lines.
 */

export interface TranscriptCue {
  /** Seconds from the start of the recording, when the source carries timecodes. */
  startSec?: number
  endSec?: number
  text: string
}

/** Parse "HH:MM:SS,mmm" / "HH:MM:SS.mmm" / "MM:SS.mmm" to seconds. */
function parseTimecode(t: string): number | undefined {
  const m = t.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/)
  if (!m) return undefined
  const h = m[1] ? Number(m[1]) : 0
  const min = Number(m[2])
  const sec = Number(m[3])
  const ms = Number(m[4].padEnd(3, '0'))
  return h * 3600 + min * 60 + sec + ms / 1000
}

/** Read a "start --> end [settings]" line into a timing pair, or null. */
function parseArrowLine(line: string): { startSec?: number; endSec?: number } | null {
  const idx = line.indexOf('-->')
  if (idx < 0) return null
  const startSec = parseTimecode(line.slice(0, idx))
  const endSec = parseTimecode(line.slice(idx + 3).trim().split(/\s+/)[0] ?? '')
  if (startSec === undefined) return null
  return { startSec, endSec }
}

/**
 * Parse transcript text into cues. Detects timed cues (SRT / VTT) by the "-->"
 * line in each block; blocks without one become untimed cues, so plain-text
 * paragraphs still import.
 */
export function parseTranscript(text: string): TranscriptCue[] {
  const clean = text
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^WEBVTT[^\n]*\n/, '')
  const blocks = clean
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  const cues: TranscriptCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const arrowIdx = lines.findIndex((l) => l.includes('-->'))
    if (arrowIdx >= 0) {
      const timing = parseArrowLine(lines[arrowIdx])
      const cueText = lines
        .slice(arrowIdx + 1)
        .join('\n')
        .trim()
      if (timing && cueText) {
        cues.push({ startSec: timing.startSec, endSec: timing.endSec, text: cueText })
      }
    } else {
      // No timecode: a plain-text paragraph (drop a stray leading numeric index).
      const cueText = block.replace(/^\d+\n/, '').trim()
      if (cueText) cues.push({ text: cueText })
    }
  }
  return cues
}
