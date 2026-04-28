// MediaRecorder wrapper for chat voice notes.
//
// Usage:
//   const r = useVoiceRecorder()
//   <button onClick={r.start}>Record</button>
//   <button onClick={r.stop} disabled={!r.recording}>Stop</button>
//
// On stop:  r.lastBlob, r.lastDurationMs are populated. The composer
// detects the change via useEffect and uploads + sends the message.
//
// On cancel: stream is torn down without producing a blob.

import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_RECORD_MS = 5 * 60 * 1000  // 5 min hard cap

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [lastDurationMs, setLastDurationMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const tickRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  const cleanup = useCallback(() => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (recording) return

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not available')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick a mime type that the browser actually supports.
      // webm/opus is well-supported in Chrome/Firefox; Safari falls back to mp4.
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      cancelledRef.current = false

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const dur = Date.now() - startedAtRef.current
        if (cancelledRef.current) {
          cleanup()
          setRecording(false)
          setDurationMs(0)
          return
        }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setLastBlob(blob)
        setLastDurationMs(dur)
        cleanup()
        setRecording(false)
        setDurationMs(0)
      }

      mr.start()
      startedAtRef.current = Date.now()
      setRecording(true)
      setDurationMs(0)
      tickRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current
        setDurationMs(elapsed)
        if (elapsed >= MAX_RECORD_MS) {
          stop()
        }
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission denied')
      cleanup()
      setRecording(false)
    }
  }, [recording, cleanup])

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    if (mr.state !== 'inactive') mr.stop()
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    stop()
  }, [stop])

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup])

  return { start, stop, cancel, recording, durationMs, lastBlob, lastDurationMs, error }
}
