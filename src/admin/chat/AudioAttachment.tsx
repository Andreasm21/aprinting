// Inline audio playback. Plain HTML5 <audio> with custom-styled controls
// would be too much code for the value — we use the native controls but
// shrink them via the wrapping container. Voice notes get a more compact
// presentation since they're typically short.

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Mic } from 'lucide-react'
import type { ChatAttachment } from '@/lib/chatStorage'

interface Props {
  attachment: ChatAttachment
}

function formatDuration(ms?: number): string {
  if (!ms || !isFinite(ms)) return '0:00'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function AudioAttachment({ attachment }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(attachment.durationMs ?? 0)

  // Voice notes (short, no name from upload) get the compact mic UI.
  // Regular audio uploads get full native controls for scrubbing.
  const isVoiceNote = attachment.name.startsWith('voice-note')

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnd = () => { setPlaying(false); setProgress(0) }
    const onTime = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }
    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration) && !duration) {
        setDuration(audio.duration * 1000)
      }
    }
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    return () => {
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [duration])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { void audio.play(); setPlaying(true) }
  }

  if (isVoiceNote) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-bg-tertiary border border-border max-w-[260px]">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="w-7 h-7 rounded-full bg-accent-amber text-bg-primary flex items-center justify-center hover:scale-105 transition-transform flex-shrink-0"
        >
          {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>
        <Mic size={11} className="text-text-muted flex-shrink-0" />
        {/* Pseudo-waveform: just an animated bar that tracks progress */}
        <div className="flex-1 h-1 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-amber transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-text-muted text-[10px] font-mono flex-shrink-0">
          {formatDuration(duration)}
        </span>
        <audio ref={audioRef} src={attachment.url} preload="metadata" />
      </div>
    )
  }

  // Regular audio file — native controls so you can scrub.
  return (
    <audio
      controls
      src={attachment.url}
      preload="metadata"
      className="max-w-[280px]"
    >
      Your browser doesn't support audio playback.
    </audio>
  )
}
