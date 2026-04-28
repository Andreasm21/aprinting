// useVoiceRoom — full mesh WebRTC for the active voice room.
//
// When called with `joined=true`, this hook:
//   1. Captures the local mic via getUserMedia({audio: true})
//   2. Subscribes to `admin-chat:voice-signal:{roomId}` broadcast channel
//      for SDP + ICE exchange
//   3. For every other participant in adminVoiceStore, opens an
//      RTCPeerConnection. The lower userId initiates the offer (deterministic
//      to avoid both sides offering simultaneously — "polite peer" pattern).
//   4. Routes remote tracks into hidden <audio autoplay> elements appended
//      to <body> so audio plays without UI plumbing.
//   5. Cleans up everything on unmount or when joined flips false.
//
// Returns:
//   { localMuted, toggleMute, peerCount, levels: Map<userId, number 0..1> }
//
// Limitations: STUN-only via Google's free servers, no TURN. ~5-10% of
// users behind strict NATs may not connect; fall back to voice notes.
// Mesh caps at 6 participants for audio quality reasons (each peer uploads
// to N-1 receivers).

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminVoiceStore } from '@/stores/adminVoiceStore'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

interface SignalPayload {
  from: string
  to: string
  kind: 'offer' | 'answer' | 'ice'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

interface PeerEntry {
  pc: RTCPeerConnection
  audioEl: HTMLAudioElement
  analyser?: AnalyserNode
  rafId?: number
}

export function useVoiceRoom(roomId: string | null, joined: boolean) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const setMutedInStore = useAdminVoiceStore((s) => s.setMuted)
  const participants = useAdminVoiceStore((s) => (roomId ? s.byRoom.get(roomId) : undefined))

  const [localMuted, setLocalMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [levels, setLevels] = useState<Map<string, number>>(new Map())

  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerEntry>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // ─── Setup local mic + signaling channel when joined flips true ───
  useEffect(() => {
    if (!joined || !roomId || !currentUser || !isSupabaseConfigured) return

    let cancelled = false

    const init = async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setError('Voice not supported in this browser')
          return
        }

        // 1. Mic
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        localStreamRef.current = stream

        // 2. Audio context for level meters
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

        // 3. Signaling channel
        const channel = supabase.channel(`admin-chat:voice-signal:${roomId}`, {
          config: { broadcast: { self: false } },
        })
          .on('broadcast', { event: 'signal' }, (payload) => {
            const data = payload.payload as SignalPayload
            if (!data || data.to !== currentUser.id) return
            void handleSignal(data)
          })
          .subscribe()
        channelRef.current = channel
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Microphone permission denied')
      }
    }

    void init()

    return () => {
      cancelled = true
      teardownAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, roomId, currentUser?.id])

  // ─── Negotiate with every other participant ───
  useEffect(() => {
    if (!joined || !roomId || !currentUser || !localStreamRef.current) return

    const otherIds = Array.from(participants?.values() ?? [])
      .map((p) => p.userId)
      .filter((id) => id !== currentUser.id)

    // Open peer connections for participants we don't have one with yet.
    for (const otherId of otherIds) {
      if (peersRef.current.has(otherId)) continue
      // The "lower id" peer initiates — avoids glare.
      const shouldOffer = currentUser.id < otherId
      void openPeer(otherId, shouldOffer)
    }

    // Tear down peers for participants who left.
    for (const id of Array.from(peersRef.current.keys())) {
      if (!otherIds.includes(id)) teardownPeer(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, joined, roomId, currentUser?.id])

  // ─── Mute/unmute ───
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !localMuted
    stream.getAudioTracks().forEach((t) => { t.enabled = !next })
    setLocalMuted(next)
    if (roomId && currentUser) void setMutedInStore(roomId, currentUser.id, next)
  }, [localMuted, roomId, currentUser, setMutedInStore])

  // ─── Helpers ───
  function newPeer(): RTCPeerConnection { return new RTCPeerConnection(ICE_SERVERS) }

  async function openPeer(otherId: string, shouldOffer: boolean) {
    if (!currentUser || !roomId) return
    const pc = newPeer()
    const audioEl = document.createElement('audio')
    audioEl.autoplay = true
    audioEl.dataset.peerId = otherId
    audioEl.style.display = 'none'
    document.body.appendChild(audioEl)
    const entry: PeerEntry = { pc, audioEl }
    peersRef.current.set(otherId, entry)

    // Add our local mic tracks
    const local = localStreamRef.current
    if (local) for (const t of local.getTracks()) pc.addTrack(t, local)

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({
        from: currentUser.id, to: otherId, kind: 'ice', candidate: e.candidate.toJSON(),
      })
    }
    pc.ontrack = (e) => {
      const [stream] = e.streams
      if (!stream) return
      audioEl.srcObject = stream
      void audioEl.play().catch(() => { /* autoplay blocked → user gesture required, ignore */ })
      attachAnalyser(otherId, stream)
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        // Optimistically tear down — store will repopulate if peer is still active
        teardownPeer(otherId)
      }
    }

    if (shouldOffer) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal({ from: currentUser.id, to: otherId, kind: 'offer', sdp: pc.localDescription! })
    }
  }

  async function handleSignal(data: SignalPayload) {
    if (!currentUser) return
    let entry = peersRef.current.get(data.from)
    if (!entry) {
      // Incoming offer from someone we haven't opened a connection to yet —
      // open one now (we're the answerer).
      if (data.kind === 'offer') {
        await openPeer(data.from, false)
        entry = peersRef.current.get(data.from)
      }
      if (!entry) return
    }
    const { pc } = entry

    if (data.kind === 'offer' && data.sdp) {
      await pc.setRemoteDescription(data.sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal({ from: currentUser.id, to: data.from, kind: 'answer', sdp: pc.localDescription! })
    } else if (data.kind === 'answer' && data.sdp) {
      await pc.setRemoteDescription(data.sdp)
    } else if (data.kind === 'ice' && data.candidate) {
      try { await pc.addIceCandidate(data.candidate) } catch (e) {
        console.warn('[voice] addIceCandidate failed', e)
      }
    }
  }

  function sendSignal(payload: SignalPayload) {
    const ch = channelRef.current
    if (!ch) return
    void ch.send({ type: 'broadcast', event: 'signal', payload })
  }

  function attachAnalyser(peerId: string, stream: MediaStream) {
    const ctx = audioCtxRef.current
    if (!ctx) return
    try {
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const entry = peersRef.current.get(peerId)
      if (!entry) return
      entry.analyser = analyser
      const tick = () => {
        if (!peersRef.current.has(peerId)) return
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (const v of data) sum += v
        const avg = sum / data.length / 255
        setLevels((prev) => {
          const next = new Map(prev)
          next.set(peerId, avg)
          return next
        })
        entry.rafId = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      console.warn('[voice] analyser attach failed', e)
    }
  }

  function teardownPeer(peerId: string) {
    const entry = peersRef.current.get(peerId)
    if (!entry) return
    try { entry.pc.close() } catch { /* ignore */ }
    if (entry.rafId) cancelAnimationFrame(entry.rafId)
    try { entry.audioEl.srcObject = null; entry.audioEl.remove() } catch { /* ignore */ }
    peersRef.current.delete(peerId)
    setLevels((prev) => {
      if (!prev.has(peerId)) return prev
      const next = new Map(prev)
      next.delete(peerId)
      return next
    })
  }

  function teardownAll() {
    for (const id of Array.from(peersRef.current.keys())) teardownPeer(id)
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current).catch(() => {})
      channelRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    setLevels(new Map())
  }

  return {
    localMuted,
    toggleMute,
    error,
    peerCount: peersRef.current.size,
    levels,
  }
}
