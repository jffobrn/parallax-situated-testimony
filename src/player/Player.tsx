import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'
import { useMediaUrl } from '../state/useMediaUrl'
import { activeStatementId, recordingDuration, statementSnippet } from '../lib/derive'

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The recording transport. With a held audio or video file it drives a real
 * media element; without one (a transcript-only account) it runs a virtual
 * playhead over the statements' clip span. Either way it owns the playhead, and
 * the playhead is what lights the active statement across the transcript, the
 * model, the map, and the chronology. This synchrony is the tool.
 */
export function Player() {
  const project = useStore((s) => s.project)
  const playing = useStore((s) => s.playing)
  const playheadSec = useStore((s) => s.playheadSec)
  const seekVersion = useStore((s) => s.seekVersion)
  const seekTargetSec = useStore((s) => s.seekTargetSec)

  const recording = project.testimony.recording
  const mediaUrl = useMediaUrl(recording?.file?.blobKey)
  const isVideo = recording?.medium === 'video' || recording?.file?.mime.startsWith('video/')
  const hasMedia = !!mediaUrl
  const duration = recordingDuration(project)

  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)

  // Seek the real element when a seek is requested, or once it mounts after a
  // seek issued while the media URL was still resolving.
  useEffect(() => {
    if (mediaRef.current && hasMedia) {
      try {
        mediaRef.current.currentTime = seekTargetSec
      } catch {
        // currentTime can throw before metadata loads; the loadedmetadata handler retries.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekVersion, hasMedia])

  // Play / pause: a real element, or a virtual requestAnimationFrame loop.
  useEffect(() => {
    if (hasMedia && mediaRef.current) {
      if (playing) void mediaRef.current.play().catch(() => useStore.getState().setPlaying(false))
      else mediaRef.current.pause()
      return
    }
    // Virtual transport.
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return
    }
    lastTsRef.current = 0
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = (ts - lastTsRef.current) / 1000
      lastTsRef.current = ts
      const next = useStore.getState().playheadSec + dt
      if (duration > 0 && next >= duration) {
        useStore.getState().setPlayhead(duration)
        useStore.getState().setPlaying(false)
        return
      }
      useStore.getState().setPlayhead(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [playing, hasMedia, duration])

  const activeId = activeStatementId(project, playheadSec)
  const active = activeId ? project.statements.find((s) => s.id === activeId) : undefined

  const togglePlay = () => {
    if (duration <= 0 && !hasMedia) return
    useStore.getState().setPlaying(!playing)
  }

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    useStore.getState().seek(parseFloat(e.target.value))
  }

  const disabled = duration <= 0 && !hasMedia

  return (
    <div className="player">
      {/* The media element is hidden; the transport below is the visible control. */}
      {hasMedia &&
        (isVideo ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaUrl ?? undefined}
            style={{ display: 'none' }}
            onTimeUpdate={(e) => useStore.getState().setPlayhead((e.target as HTMLVideoElement).currentTime)}
            onLoadedMetadata={(e) => {
              ;(e.target as HTMLVideoElement).currentTime = useStore.getState().playheadSec
            }}
            onEnded={() => useStore.getState().setPlaying(false)}
          />
        ) : (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={mediaUrl ?? undefined}
            onTimeUpdate={(e) => useStore.getState().setPlayhead((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={(e) => {
              ;(e.target as HTMLAudioElement).currentTime = useStore.getState().playheadSec
            }}
            onEnded={() => useStore.getState().setPlaying(false)}
          />
        ))}

      <button
        className="player-play"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={playing ? 'pause' : 'play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <span className="player-time mono">{fmtClock(playheadSec)}</span>

      <input
        className="player-seek"
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.1}
        value={Math.min(playheadSec, Math.max(duration, 0.1))}
        onChange={onScrub}
        disabled={disabled}
        aria-label="seek recording"
      />

      <span className="player-time mono faint">{fmtClock(duration)}</span>

      <span className="player-now">
        {disabled ? (
          <span className="faint">no recording or clips</span>
        ) : active ? (
          <span className="signal" dir="auto">{statementSnippet(active, 56)}</span>
        ) : (
          <span className="faint">{recording?.title ?? 'recording'}</span>
        )}
      </span>
    </div>
  )
}
