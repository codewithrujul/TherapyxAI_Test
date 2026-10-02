/**
 * VoiceMic.jsx — with clear state visuals, ChatBox palette
 *
 * IDLE       → mic icon, dim, no animation
 * LISTENING  → green mic + 3 expanding ripple rings radiating outward
 * PROCESSING → mic icon + spinner ring around button
 * STREAMING  → blue wave bars inside button + blue pulse ring
 *
 * First tap starts listening; after silence, audio is sent; after reply playback
 * finishes, the mic reopens automatically (no tap). Playback blocks the mic to avoid echo.
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch } from 'react-redux';
import { enqueueAudioChunk, clearAudioChunks, setAudioResponseMeta } from '../redux/globalSlice';
import { WS_BASE } from '../config';

const MIC_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,
  },
};

// Instagram's in-app browser may prompt again whenever a MediaStream is fully
// stopped. Prime the stream from the setup-screen user gesture, then hand that
// same live stream to VoiceMic when the session starts.
let primedMicPromise = null;
let primedMicStream = null;
let primedMicCleanupTimer = null;

export function primeMicrophoneStream() {
  if (primedMicStream?.getAudioTracks().some((track) => track.readyState === 'live')) {
    return Promise.resolve(primedMicStream);
  }
  if (primedMicPromise) return primedMicPromise;
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('Microphone access is not supported'));
  }

  primedMicPromise = navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    .then((stream) => {
      primedMicStream = stream;
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      clearTimeout(primedMicCleanupTimer);
      primedMicCleanupTimer = setTimeout(() => {
        if (primedMicStream === stream) {
          stream.getTracks().forEach((track) => track.stop());
          primedMicStream = null;
        }
      }, 30000);
      return stream;
    })
    .finally(() => {
      primedMicPromise = null;
    });

  return primedMicPromise;
}

async function consumePrimedMicrophoneStream() {
  if (primedMicPromise) await primedMicPromise.catch(() => null);
  const stream = primedMicStream;
  primedMicStream = null;
  clearTimeout(primedMicCleanupTimer);
  primedMicCleanupTimer = null;
  return stream?.getAudioTracks().some((track) => track.readyState === 'live') ? stream : null;
}

const STYLES = `
  @keyframes vm-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes vm-pulse-glow {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(37,99,235,0.35), 0 20px 50px -20px rgba(37,99,235,0.45);
    }
    50% {
      box-shadow: 0 0 0 18px rgba(37,99,235,0), 0 24px 60px -18px rgba(37,99,235,0.55);
    }
  }
  @keyframes vm-dot-pulse {
    0%, 100% { opacity: 1;   }
    50%       { opacity: 0.3; }
  }
  .vm-spin       { animation: vm-spin 1s linear infinite; }
  .vm-pulse-glow { animation: vm-pulse-glow 2.4s ease-in-out infinite; }
  .vm-dot-pulse  { animation: vm-dot-pulse 2s ease-in-out infinite; }
`;

const S = {
  IDLE:       'idle',
  LISTENING:  'listening',
  PROCESSING: 'processing',
  STREAMING:  'streaming',
};

/**
 * WaveformCanvas — organic sine-wave visualiser with per-phase character.
 * phase: 'idle' | 'listening' | 'processing' | 'speaking'
 */
const WAVE_PHASES = {
  idle: {
    primary: '#2563eb', glow: '#60a5fa',
    layers: [
      { freq: 0.8, speed: 0.3, weight: 0.5, alpha: 0.55, lw: 1.6 },
    ],
  },
  listening: {
    primary: '#2563eb', glow: '#60a5fa',
    layers: [
      { freq: 1.1, speed: 1.2, weight: 0.60, alpha: 0.95, lw: 2.4 },
      { freq: 1.7, speed: 0.8, weight: 0.45, alpha: 0.50, lw: 1.6 },
      { freq: 2.6, speed: 1.6, weight: 0.30, alpha: 0.30, lw: 1.2 },
    ],
  },
  processing: {
    primary: '#9ba8c0', glow: '#b0bcd4',
    layers: [
      { freq: 0.5, speed: 0.18, weight: 0.30, alpha: 0.40, lw: 1.5 },
      { freq: 0.9, speed: 0.12, weight: 0.18, alpha: 0.22, lw: 1.0 },
    ],
  },
  speaking: {
    primary: '#60a5fa', glow: '#6dcec4',
    layers: [
      { freq: 1.4, speed: 2.0,  weight: 0.70, alpha: 0.95, lw: 2.6 },
      { freq: 2.2, speed: 1.3,  weight: 0.50, alpha: 0.55, lw: 1.8 },
      { freq: 3.4, speed: 2.6,  weight: 0.32, alpha: 0.28, lw: 1.2 },
    ],
  },
};

function WaveformCanvas({ active, intensity = 0.6, phase = 'idle' }) {
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const startRef   = useRef(0);
  const ampRef     = useRef(active ? intensity : 0.12);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width  = Math.max(1, Math.floor(width  * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (t) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = (t - startRef.current) / 1000;

      // Smoothly ease amplitude toward target
      const target = active ? intensity : 0.12;
      ampRef.current += (target - ampRef.current) * 0.06;
      const amp = ampRef.current;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Pick config for current phase
      const cfg = WAVE_PHASES[phase] ?? WAVE_PHASES.idle;

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0,   cfg.primary);
      grad.addColorStop(0.5, cfg.glow);
      grad.addColorStop(1,   cfg.primary);

      const layers = cfg.layers.map(l => ({ ...l, lw: l.lw * dpr }));

      const midY    = h / 2;
      const baseAmp = (h / 2) * 0.85;

      layers.forEach((layer, idx) => {
        ctx.beginPath();
        ctx.lineWidth   = layer.lw;
        ctx.strokeStyle = grad;
        ctx.globalAlpha = layer.alpha;

        const step = Math.max(2, Math.floor(2 * dpr));
        for (let x = 0; x <= w; x += step) {
          const nx      = x / w;
          const env     = Math.sin(nx * Math.PI); // fade near edges
          const phaseOff = elapsed * layer.speed + idx * 0.6;
          const wave    =
            Math.sin(nx * Math.PI * 2 * layer.freq + phaseOff) * 0.7 +
            Math.sin(nx * Math.PI * 2 * (layer.freq * 1.7) + phaseOff * 0.8) * 0.3;
          const y = midY + wave * env * baseAmp * amp * layer.weight;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      rafRef.current  = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [active, intensity, phase]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
/** RMS in ~0–0.35 range for typical speech; noise floor often under 0.01 */
const VoiceMic = forwardRef(function VoiceMic({
                                   wsUrl             = `${WS_BASE}/ws/voice`,
                                   token             = '',
                                   sessionId         = '',
                                   languageCode      = 'en-IN',
                                   guestId           = '',
                                   guestName         = '',
                                   reason            = '',
                                   /** Time-domain RMS above this counts as speech (not frequency-bin average). */
                                   silenceThreshold  = 0.022,
                                   silenceMs         = 1500,   // ms of silence before end_of_speech (was 900→1200→1500)
                                   vadIntervalMs     = 80,
                                   /** Must detect speech at least this long before silence can end the turn. */
                                   noiseGateMs       = 300,    // min confirmed speech before silence counts (was 220)
                                   /** Ignore VAD until this long after listen starts (click / system noise). */
                                   vadWarmupMs       = 450,
                                   autoRestartOnDone = true,
                                   /** When true, the mic/pause buttons are not rendered (parent handles controls). */
                                   hideControls      = false,
                                   /** Called whenever control-relevant state changes — passes snapshot for parent control bar. */
                                   onControlState,
                                   onStateChange,
                                   onTranscript,
                                   onToken,
                                   onDone,
                                   onError,
                                 }, ref) {
  const dispatch = useDispatch();

  const [voiceState,     setVoiceState_]  = useState(S.IDLE);
  const [authed,         setAuthed]       = useState(false);
  const [isPaused,       setIsPaused]     = useState(false);
  const [hasStarted,     setHasStarted]   = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isPausedRef = useRef(false);

  const voiceWs        = useRef(null);
  const voiceStateRef  = useRef(S.IDLE);
  const authedRef      = useRef(false);

  // ── Reconnect state ───────────────────────────────────────────────────────
  const reconnectAttemptRef  = useRef(0);
  const reconnectTimerRef    = useRef(null);
  const intentionalCloseRef  = useRef(false);
  const connectVoiceRef      = useRef(null);
  const RECONNECT_BACKOFF    = [1000, 2000, 4000, 8000, 15000];
  const MAX_RECONNECT        = 8;

  const mediaRecorder  = useRef(null);
  const currentStream  = useRef(null);
  const audioCtxRef    = useRef(null);
  const workletNodeRef = useRef(null);   // AudioWorkletNode for PCM capture
  const recordCtxRef   = useRef(null);   // 16 kHz AudioContext for recording
  const analyserRef    = useRef(null);
  const vadInterval    = useRef(null);
  const silenceTimer   = useRef(null);
  const isSpeaking     = useRef(false);
  const speakingSince  = useRef(null);

  // Map<seq, AudioBuffer|null> — populated as decodes finish, drained in order
  const readyBuffers         = useRef(new Map());
  const activeSourcesCount   = useRef(0);    // how many AudioBufferSourceNodes are currently playing
  const activeSourcesRef     = useRef(new Set());
  const nextAudioStartTime   = useRef(0);    // Web Audio clock: when the next chunk should start
  const timings        = useRef({});

  /** True while assistant audio is playing or queued — never open mic in this window (avoids echo). */
  const playbackBlockingRef = useRef(false);
  /** User started a voice session (first click); auto-relisten only while this is true. */
  const voiceSessionActiveRef = useRef(false);
  /** Ensures the AI greeting is only triggered once per mount — not on reconnects. */
  const hasGreetedRef = useRef(false);
  /** True while the opening greeting response is streaming/playing — cleared on its done event. */
  const isGreetingPlayingRef = useRef(false);

  const startListeningRef = useRef(null);
  const micStartInFlightRef = useRef(false);

  const playHead         = useRef(0);
  const totalChunks      = useRef(null);
  const audioFinishedRes = useRef(null);
  const audioFinished    = useRef(null);
  /** Highest `seq` seen on incoming `audio` messages this turn. */
  const maxAudioSeqRef         = useRef(-1);
  /** Number of `audio` messages received this turn (for inferring total when server omits or overstates). */
  const audioChunksReceivedRef = useRef(0);
  /** Local 0..n-1 order for queue playback (never rely on server seq matching playHead after prior turns). */
  const localEnqueueSeqRef     = useRef(0);
  const doneReceivedRef    = useRef(false);
  const playbackSettledRef = useRef(false);
  const doneWatchdogRef    = useRef(null);
  const micRestartIntervalRef = useRef(null);
  /** Set when assistant playback finished — next startListening clears stale blocking flags (speech_start must send). */
  const pendingAssistantResumeRef = useRef(false);
  /** Prevents scheduling mic resume + multiple speech_start bursts (server restarts reply → first line repeats). */
  const assistantResumeScheduledRef = useRef(false);
  const resumeKickTimeoutRef = useRef(null);

  useEffect(() => {
    if (document.getElementById('vm-s')) return;
    const el = document.createElement('style');
    el.id = 'vm-s'; el.textContent = STYLES;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    audioFinished.current = new Promise((res) => { audioFinishedRes.current = res; });
  }, []);

  const setVoiceState = useCallback((s) => {
    voiceStateRef.current = s;
    setVoiceState_(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtxRef.current;
  };

  /** True only when UI "listening" matches a live mic + recording (avoids fake LISTENING blocking startListening). */
  const isCaptureLive = () => {
    const stream = currentStream.current;
    if (!stream) return false;
    if (!stream.getTracks().some((t) => t.readyState === 'live')) return false;
    // AudioWorklet path (replaces MediaRecorder)
    if (workletNodeRef.current) return true;
    // Legacy MediaRecorder path
    const rec = mediaRecorder.current;
    return !!(rec && rec.state === 'recording');
  };

  const resetAudio = () => {
    if (resumeKickTimeoutRef.current) {
      clearTimeout(resumeKickTimeoutRef.current);
      resumeKickTimeoutRef.current = null;
    }
    if (doneWatchdogRef.current) {
      clearInterval(doneWatchdogRef.current);
      doneWatchdogRef.current = null;
    }
    if (micRestartIntervalRef.current) {
      clearInterval(micRestartIntervalRef.current);
      micRestartIntervalRef.current = null;
    }
    doneReceivedRef.current    = false;
    assistantResumeScheduledRef.current = false;
    playbackSettledRef.current   = false;
    maxAudioSeqRef.current       = -1;
    audioChunksReceivedRef.current = 0;
    localEnqueueSeqRef.current     = 0;
    readyBuffers.current.clear();
    activeSourcesCount.current = 0;
    nextAudioStartTime.current = 0;
    playHead.current           = 0;
    totalChunks.current        = null;
    audioFinishedRes.current   = null;
    audioFinished.current      = new Promise(res => { audioFinishedRes.current = res; });
  };

  const stopAllAudio = () => {
    if (resumeKickTimeoutRef.current) {
      clearTimeout(resumeKickTimeoutRef.current);
      resumeKickTimeoutRef.current = null;
    }
    if (doneWatchdogRef.current) {
      clearInterval(doneWatchdogRef.current);
      doneWatchdogRef.current = null;
    }
    if (micRestartIntervalRef.current) {
      clearInterval(micRestartIntervalRef.current);
      micRestartIntervalRef.current = null;
    }
    activeSourcesRef.current.forEach((src) => {
      try { src.onended = null; } catch {}
      try { src.stop(0); } catch {}
      try { src.disconnect(); } catch {}
    });
    activeSourcesRef.current.clear();
    doneReceivedRef.current        = false;
    readyBuffers.current.clear();
    activeSourcesCount.current     = 0;
    nextAudioStartTime.current     = 0;
    playHead.current               = 0;
    localEnqueueSeqRef.current     = 0;
    totalChunks.current            = null;
    playbackBlockingRef.current    = false;
    playbackSettledRef.current     = true;
    /* Do not resolve audioFinished here — avoids accidental mic restart side effects. */
  };

  const decodeChunk = (b64) => {
    const ctx   = getAudioCtx();
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return ctx.decodeAudioData(bytes.buffer);
  };


  const finishPlaybackAndScheduleMic = useCallback(() => {
    if (assistantResumeScheduledRef.current) return;
    assistantResumeScheduledRef.current = true;
    playbackBlockingRef.current = false;
    pendingAssistantResumeRef.current = true;
    setVoiceState(S.IDLE);
    if (!autoRestartOnDone || isPausedRef.current) {
      pendingAssistantResumeRef.current = false;
      assistantResumeScheduledRef.current = false;
      return;
    }
    if (micRestartIntervalRef.current) {
      clearInterval(micRestartIntervalRef.current);
      micRestartIntervalRef.current = null;
    }
    if (resumeKickTimeoutRef.current) {
      clearTimeout(resumeKickTimeoutRef.current);
      resumeKickTimeoutRef.current = null;
    }
    const kick = () => {
      resumeKickTimeoutRef.current = null;
      if (voiceStateRef.current === S.LISTENING && isCaptureLive()) return;
      void startListeningRef.current?.();
    };
    /* One delayed attempt — multiple speech_start events restart the server stream and repeat the first line. */
    resumeKickTimeoutRef.current = setTimeout(kick, 550);
  }, [autoRestartOnDone, setVoiceState]);

  const resolvePlaybackIfReady = useCallback(() => {
    if (playbackSettledRef.current) return;
    const n       = totalChunks.current;
    const hasMore = readyBuffers.current.size > 0 || activeSourcesCount.current > 0;
    if (hasMore) return;
    if (n == null || n === 0) {
      if (maxAudioSeqRef.current < 0 && audioChunksReceivedRef.current === 0) {
        playbackSettledRef.current = true;
        if (doneWatchdogRef.current) { clearInterval(doneWatchdogRef.current); doneWatchdogRef.current = null; }
        audioFinishedRes.current?.();
        finishPlaybackAndScheduleMic();
      }
      return;
    }
    if (playHead.current >= n) {
      playbackSettledRef.current = true;
      if (doneWatchdogRef.current) { clearInterval(doneWatchdogRef.current); doneWatchdogRef.current = null; }
      audioFinishedRes.current?.();
      finishPlaybackAndScheduleMic();
    }
  }, [finishPlaybackAndScheduleMic]);

  const checkAllPlayed = useCallback(() => {
    resolvePlaybackIfReady();
  }, [resolvePlaybackIfReady]);

  // Pre-schedule: called whenever a buffer decode completes.
  // Drains readyBuffers in strict seq order and schedules each buffer
  // directly on the Web Audio clock — no await, no sequential blocking.
  const tryScheduleNext = useCallback(() => {
    while (readyBuffers.current.has(playHead.current)) {
      const buf = readyBuffers.current.get(playHead.current);
      readyBuffers.current.delete(playHead.current);

      if (!buf) {
        // decode failed for this seq — skip silently
        playHead.current += 1;
        continue;
      }

      const ctx       = getAudioCtx();
      // 12 ms look-ahead: enough for the browser to prepare hardware output
      const startAt   = Math.max(ctx.currentTime + 0.012, nextAudioStartTime.current);
      nextAudioStartTime.current = startAt + buf.duration;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      activeSourcesRef.current.add(src);
      activeSourcesCount.current = activeSourcesRef.current.size;
      src.onended = () => {
        activeSourcesRef.current.delete(src);
        activeSourcesCount.current = activeSourcesRef.current.size;
        checkAllPlayed();
      };

      const play = () => src.start(startAt);
      if (ctx.state === 'suspended') ctx.resume().then(play).catch(play);
      else play();

      playHead.current += 1;
    }
    checkAllPlayed();
  }, [checkAllPlayed]);

  const clearVAD = () => {
    clearInterval(vadInterval.current); vadInterval.current  = null;
    clearTimeout(silenceTimer.current); silenceTimer.current = null;
    isSpeaking.current    = false;
    speakingSince.current = null;
  };

  const stopMic = useCallback((releaseStream = true) => {
    clearVAD();
    // ── AudioWorklet teardown ──────────────────────────────────────────────
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (recordCtxRef.current) {
      recordCtxRef.current.close().catch(() => {});
      recordCtxRef.current = null;
    }
    // ── Legacy MediaRecorder (no longer used for STT, kept for safety) ────
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive')
      mediaRecorder.current.stop();
    mediaRecorder.current = null;
    if (currentStream.current) {
      if (releaseStream) {
        currentStream.current.getTracks().forEach(t => t.stop());
        currentStream.current = null;
      } else {
        currentStream.current.getAudioTracks().forEach((track) => { track.enabled = false; });
      }
    }
    analyserRef.current = null;
  }, []);

  const sendEndOfSpeech = useCallback(() => {
    // If the user never actually spoke, don't send blank audio — just reset
    if (!isSpeaking.current) {
      stopMic(false);
      setVoiceState(S.IDLE);
      return;
    }
    timings.current.speechEnd = Date.now();
    assistantResumeScheduledRef.current = false;
    playbackBlockingRef.current = false;
    stopMic(false);
    if (voiceWs.current?.readyState === WebSocket.OPEN)
      voiceWs.current.send(JSON.stringify({ type: 'end_of_speech' }));
    setVoiceState(S.PROCESSING);
  }, [stopMic, setVoiceState]);

  const handleVoiceMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'auth:success':
        authedRef.current = true;
        setAuthed(true);
        setVoiceState(S.IDLE);
        setIsReconnecting(false);
        reconnectAttemptRef.current = 0;
        // If mic was active before the drop, restart listening automatically
        if (voiceSessionActiveRef.current && !isPausedRef.current) {
          setTimeout(() => startListeningRef.current?.(), 600);
        }
        // AI initiates the session with a greeting — only on first connect, never on reconnects
        if (!hasGreetedRef.current) {
          hasGreetedRef.current    = true;
          isGreetingPlayingRef.current = true;
          resetAudio();
          dispatch(clearAudioChunks());
          setTimeout(() => {
            if (voiceWs.current?.readyState === WebSocket.OPEN) {
              voiceWs.current.send(JSON.stringify({ type: 'greet' }));
            }
          }, 400);
        }
        break;

      case 'error':
        playbackBlockingRef.current = false;
        stopMic();
        setVoiceState(S.IDLE);
        onError?.(msg.message || msg.text || 'Unknown error');
        break;

      case 'status':
        if (msg.text?.includes('No speech')) {
          // Backend got blank audio — reset silently, restart listening if active
          playbackBlockingRef.current = false;
          setVoiceState(S.IDLE);
          if (voiceSessionActiveRef.current && !isPausedRef.current)
            setTimeout(() => startListeningRef.current?.(), 300);
        } else if (msg.text?.includes('Transcrib') || msg.text?.includes('Think')) {
          setVoiceState(S.PROCESSING);
        }
        break;

      case 'transcript':
        timings.current.transcript = Date.now();
        resetAudio();
        dispatch(clearAudioChunks());
        playbackBlockingRef.current = true;
        onTranscript?.(msg.text);
        break;

      case 'token':
        if (!timings.current.firstToken) {
          timings.current.firstToken = Date.now();
          setVoiceState(S.STREAMING);
        }
        playbackBlockingRef.current = true;
        onToken?.(msg.text);
        break;

      case 'audio': {
        if (!timings.current.firstAudio) timings.current.firstAudio = Date.now();
        console.log(`[VoiceMic] audio chunk seq=${msg.seq} dataLen=${msg.data?.length ?? 0}`);
        playbackBlockingRef.current = true;
        audioChunksReceivedRef.current += 1;
        const seq = localEnqueueSeqRef.current++;
        maxAudioSeqRef.current = Math.max(maxAudioSeqRef.current, seq);
        dispatch(enqueueAudioChunk({ seq, data: msg.data }));
        // Decode async; schedule immediately when ready — no sequential blocking
        decodeChunk(msg.data)
          .then(buf => { readyBuffers.current.set(seq, buf);  tryScheduleNext(); })
          .catch((err) => {
            console.error(`[VoiceMic] Audio decode failed seq=${seq}:`, err);
            readyBuffers.current.set(seq, null);
            tryScheduleNext();
          });
        break;
      }

      case 'done': {
        doneReceivedRef.current = true;

        // If this is the greeting's done event, activate the session so the mic
        // auto-starts once the greeting audio finishes playing.
        if (isGreetingPlayingRef.current) {
          isGreetingPlayingRef.current   = false;
          voiceSessionActiveRef.current  = true;
          setHasStarted(true);
        }

        const serverN = msg.totalChunks;
        dispatch(setAudioResponseMeta({ isStreaming: false, totalChunks: serverN ?? null }));
        const received = audioChunksReceivedRef.current;
        let n = 0;
        if (received > 0) {
          n = serverN != null && serverN > 0 ? Math.min(serverN, received) : received;
        } else if (serverN != null && serverN > 0) {
          n = serverN;
        }
        totalChunks.current = n;

        const t = timings.current;
        if (t.speechEnd) {
          console.table({
            'STT':         `${(t.transcript || t.speechEnd) - t.speechEnd}ms`,
            'First token': `${t.firstToken ? t.firstToken - (t.transcript || t.speechEnd) : '?'}ms`,
            'First audio': `${t.firstAudio ? t.firstAudio - (t.transcript || t.speechEnd) : 'no audio'}ms`,
            'Total':       `${Date.now() - t.speechEnd}ms`,
          });
        }
        timings.current = {};
        onDone?.();

        resolvePlaybackIfReady();
        checkAllPlayed();

        if (doneWatchdogRef.current) {
          clearInterval(doneWatchdogRef.current);
          doneWatchdogRef.current = null;
        }
        if (!playbackSettledRef.current) {
          let ticks = 0;
          doneWatchdogRef.current = setInterval(() => {
            ticks += 1;
            resolvePlaybackIfReady();
            checkAllPlayed();
            if (playbackSettledRef.current) {
              if (doneWatchdogRef.current) {
                clearInterval(doneWatchdogRef.current);
                doneWatchdogRef.current = null;
              }
              return;
            }
            const idle = readyBuffers.current.size === 0 && activeSourcesCount.current === 0;
            if (idle && ticks > 30) {
              playbackSettledRef.current = true;
              if (doneWatchdogRef.current) {
                clearInterval(doneWatchdogRef.current);
                doneWatchdogRef.current = null;
              }
              audioFinishedRes.current?.();
              finishPlaybackAndScheduleMic();
            }
          }, 100);
        }

        break;
      }

      case 'pong': break;
      default:     break;
    }
  }, [dispatch, setVoiceState, stopMic, tryScheduleNext, onTranscript, onToken, onDone, onError, resolvePlaybackIfReady, checkAllPlayed, finishPlaybackAndScheduleMic]);

  const startListening = useCallback(async () => {
    if (!authedRef.current) return;
    if (!voiceWs.current || voiceWs.current.readyState !== WebSocket.OPEN) return;
    if (resumeKickTimeoutRef.current) {
      clearTimeout(resumeKickTimeoutRef.current);
      resumeKickTimeoutRef.current = null;
    }

    const resumeAfterAssistant = pendingAssistantResumeRef.current;
    if (resumeAfterAssistant) {
      playbackBlockingRef.current = false;
      if (voiceStateRef.current === S.STREAMING || voiceStateRef.current === S.PROCESSING) {
        setVoiceState(S.IDLE);
      }
    }

    if (voiceStateRef.current === S.LISTENING) {
      if (isCaptureLive()) return;
      stopMic(false);
      setVoiceState(S.IDLE);
    }
    if (micStartInFlightRef.current) return;

    /* Stale flags from a previous turn block this function forever — clear when nothing is actually playing. */
    if (activeSourcesCount.current === 0 && readyBuffers.current.size === 0) {
      playbackBlockingRef.current = false;
    }
    if (playbackBlockingRef.current) {
      setTimeout(() => startListeningRef.current?.(), 320);
      return;
    }
    if (voiceStateRef.current === S.PROCESSING || voiceStateRef.current === S.STREAMING) {
      if (activeSourcesCount.current === 0 && readyBuffers.current.size === 0) {
        setVoiceState(S.IDLE);
      } else {
        setTimeout(() => startListeningRef.current?.(), 320);
        return;
      }
    }
    if (activeSourcesCount.current > 0 || readyBuffers.current.size > 0) {
      setTimeout(() => startListeningRef.current?.(), 320);
      return;
    }

    if (doneWatchdogRef.current) {
      clearInterval(doneWatchdogRef.current);
      doneWatchdogRef.current = null;
    }
    if (micRestartIntervalRef.current) {
      clearInterval(micRestartIntervalRef.current);
      micRestartIntervalRef.current = null;
    }
    doneReceivedRef.current               = false;
    assistantResumeScheduledRef.current   = false;
    playbackSettledRef.current            = false;
    maxAudioSeqRef.current                = -1;
    audioChunksReceivedRef.current        = 0;
    localEnqueueSeqRef.current            = 0;
    readyBuffers.current.clear();
    activeSourcesCount.current            = 0;
    nextAudioStartTime.current            = 0;
    playHead.current                      = 0;
    totalChunks.current                   = null;

    micStartInFlightRef.current = true;
    let stream;
    try {
      const existingStream = currentStream.current;
      const existingIsLive = existingStream?.getAudioTracks()
        .some((track) => track.readyState === 'live');
      stream = existingIsLive
        ? existingStream
        : (await consumePrimedMicrophoneStream())
          ?? await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
    } catch (err) {
      micStartInFlightRef.current = false;
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      onError?.(isDenied ? 'mic_permission_denied' : 'mic_access_failed');
      return;
    }
    currentStream.current = stream;

    const ws = voiceWs.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      micStartInFlightRef.current = false;
      stream.getTracks().forEach((t) => t.stop());
      currentStream.current = null;
      onError?.('Voice connection lost');
      return;
    }
    /* Send immediately after mic grant — before analyser setup — so the server always sees speech_start first. */
    try {
      ws.send(JSON.stringify({ type: 'speech_start' }));
    } catch (e) {
      micStartInFlightRef.current = false;
      stream.getTracks().forEach((t) => t.stop());
      currentStream.current = null;
      onError?.('Could not notify server (speech_start)');
      return;
    }
    if (resumeAfterAssistant) pendingAssistantResumeRef.current = false;
    setVoiceState(S.LISTENING);

    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    analyserRef.current = analyser;
    const timeData = new Uint8Array(analyser.fftSize);

    // ── AudioWorklet PCM capture (16 kHz mono Int16, 100 ms chunks) ─────────
    // Dedicated 16 kHz AudioContext so the worklet runs at exactly 16 kHz —
    // the browser resamples from the mic's native rate automatically.
    let recordCtx;
    try {
      recordCtx = new AudioContext({ sampleRate: 16000 });
      recordCtxRef.current = recordCtx;
      await recordCtx.audioWorklet.addModule('/worklets/pcm-processor.js');
      const workletNode = new AudioWorkletNode(recordCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;
      recordCtx.createMediaStreamSource(stream).connect(workletNode);
      workletNode.port.onmessage = ({ data }) => {
        // data: ArrayBuffer — 1600 × Int16 = 100 ms of 16 kHz mono PCM
        if (voiceWs.current?.readyState === WebSocket.OPEN)
          voiceWs.current.send(data);
      };
    } catch (e) {
      micStartInFlightRef.current = false;
      stopMic();
      setVoiceState(S.IDLE);
      onError?.('AudioWorklet setup failed: ' + e.message);
      return;
    }

    isSpeaking.current    = false;
    speakingSince.current = null;
    silenceTimer.current  = null;
    const vadStartTime    = Date.now();

    const rmsFromTimeDomain = () => {
      const a = analyserRef.current;
      if (!a) return 0;
      a.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / timeData.length);
    };

    vadInterval.current = setInterval(() => {
      if (!analyserRef.current) return;
      if (Date.now() - vadStartTime < vadWarmupMs) return;

      const rms = rmsFromTimeDomain();

      if (rms > silenceThreshold) {
        if (!isSpeaking.current) {
          isSpeaking.current    = true;
          speakingSince.current = Date.now();
        }
        if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
      } else {
        if (isSpeaking.current && !silenceTimer.current) {
          const spokenFor = Date.now() - (speakingSince.current ?? Date.now());
          if (spokenFor >= noiseGateMs) {
            silenceTimer.current = setTimeout(() => sendEndOfSpeech(), silenceMs);
          }
        }
      }
    }, vadIntervalMs);

    micStartInFlightRef.current = false;
  }, [silenceThreshold, silenceMs, vadIntervalMs, noiseGateMs, vadWarmupMs, sendEndOfSpeech, setVoiceState, onError, stopMic]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const connectVoice = useCallback(() => {
    if (!token && !guestId) return;

    // Cancel any pending reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close existing socket — strip handlers first so onclose never fires reconnect logic
    if (voiceWs.current && voiceWs.current.readyState !== WebSocket.CLOSED) {
      const old = voiceWs.current;
      old.onopen    = null;
      old.onmessage = null;
      old.onerror   = null;
      old.onclose   = null;
      old.close();
    }
    voiceWs.current = null;

    authedRef.current = false;
    setAuthed(false);

    const socket = new WebSocket(wsUrl);
    voiceWs.current = socket;

    const timeout = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        socket.close();
        onError?.('Connection timeout');
      }
    }, 15000);

    socket.onopen = () => {
      clearTimeout(timeout);
      if (guestId && guestName) {
        socket.send(JSON.stringify({ type: 'auth', guest_id: guestId, guest_name: guestName, languageCode, reason }));
      } else {
        socket.send(JSON.stringify({ type: 'auth', token, languageCode, sessionId, reason }));
      }
    };

    socket.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      handleVoiceMessage(msg);
    };

    socket.onclose = () => {
      clearTimeout(timeout);
      setAuthed(false);
      authedRef.current = false;
      stopMic();
      stopAllAudio();
      if (voiceStateRef.current !== S.IDLE) setVoiceState(S.IDLE);

      if (!intentionalCloseRef.current) {
        const attempt = reconnectAttemptRef.current;
        if (attempt < MAX_RECONNECT) {
          setIsReconnecting(true);
          const delay = RECONNECT_BACKOFF[Math.min(attempt, RECONNECT_BACKOFF.length - 1)];
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptRef.current += 1;
            connectVoiceRef.current?.();
          }, delay);
        } else {
          setIsReconnecting(false);
          onError?.('Connection lost. Please refresh the page.');
        }
      }
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      // onclose will fire after onerror and handle reconnect
    };
  }, [wsUrl, token, sessionId, languageCode, guestId, guestName, reason, handleVoiceMessage, stopMic, setVoiceState, onError]);

  useEffect(() => { connectVoiceRef.current = connectVoice; }, [connectVoice]);

  useEffect(() => {
    reconnectAttemptRef.current = 0;
    connectVoice();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      stopMic();
      stopAllAudio();
      voiceWs.current?.close();
    };
  }, [wsUrl, token, sessionId, languageCode, guestId, stopMic]);

  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    voiceSessionActiveRef.current = false;
    stopMic(false);
    stopAllAudio();
    setVoiceState(S.IDLE);
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    voiceSessionActiveRef.current = true;
    startListening();
  };

  const handleMicClick = () => {
    if (!authedRef.current) return;
    // If paused, mic button acts as resume
    if (isPausedRef.current) {
      handleResume();
      return;
    }
    const s = voiceStateRef.current;
    if (s === S.IDLE) {
      voiceSessionActiveRef.current = true;
      setHasStarted(true);
      startListening();
    } else if (s === S.LISTENING) {
      sendEndOfSpeech();
    } else if (s === S.STREAMING) {
      stopAllAudio();
      stopMic(false);
      startListening();
    }
  };

  // ── Expose handlers to parent via ref ────────────────────────────────────
  useImperativeHandle(ref, () => ({
    micClick: handleMicClick,
    pause:    handlePause,
    resume:   handleResume,
  }), []);  // handlers are stable plain functions, no deps needed

  // ── Notify parent of control-relevant state changes ───────────────────────
  useEffect(() => {
    if (!onControlState) return;
    const isListening_  = voiceState === S.LISTENING;
    const isProcessing_ = voiceState === S.PROCESSING;
    const isStreaming_  = voiceState === S.STREAMING;
    onControlState({
      isListening:   isListening_,
      isProcessing:  isProcessing_,
      isStreaming:   isStreaming_,
      isPaused,
      hasStarted,
      authed,
      isReconnecting,
      stateLabel: !authed
        ? (isReconnecting ? 'Reconnecting…' : 'Connecting…')
        : isListening_  ? 'Listening…'
        : isProcessing_ ? 'Thinking…'
        : isStreaming_  ? 'Therapyxai is speaking'
        : hasStarted   ? 'Tap the mic to speak'
        :                'Tap the mic to begin',
      waveActive:    isListening_ || isStreaming_,
      waveIntensity: isStreaming_ ? 0.85 : isListening_ ? 0.6 : 0.25,
      wavePhase:     isListening_ ? 'listening' : isProcessing_ ? 'processing' : isStreaming_ ? 'speaking' : 'idle',
    });
  }, [voiceState, isPaused, hasStarted, authed, isReconnecting, onControlState]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isListening  = voiceState === S.LISTENING;
  const isProcessing = voiceState === S.PROCESSING;
  const isStreaming  = voiceState === S.STREAMING;
  const isDisabled   = isProcessing || !authed;

  // Waveform state — maps voice state to canvas props
  const waveActive    = isListening || isStreaming;
  const waveIntensity = isStreaming ? 0.85 : isListening ? 0.6 : 0.25;
  const wavePhase     = isListening ? 'listening' : isProcessing ? 'processing' : isStreaming ? 'speaking' : 'idle';

  // Status label
  const stateLabel = !authed
    ? (isReconnecting ? 'Reconnecting…' : 'Connecting…')
    : isListening  ? 'Listening…'
    : isProcessing ? 'Thinking…'
    : isStreaming   ? 'Therapyxai is speaking'
    : hasStarted   ? 'Tap the mic to speak'
    :                'Tap the mic to begin';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: '100%',
      height: hideControls ? '100%' : 'auto',
      gap: hideControls ? 0 : 12,
    }}>

      {/* ── Main row: waveform left, mic controls right ── */}
      <div style={{
        display: 'flex', alignItems: 'center', width: '100%', gap: 16,
        flex: hideControls ? 1 : 'none',
        height: hideControls ? '100%' : 'auto',
      }}>

        {/* Waveform canvas — fills remaining width */}
        <div style={{
          position: 'relative',
          flex: 1,
          height: hideControls ? '100%' : 120,
          minHeight: hideControls ? 0 : 120,
          borderRadius: hideControls ? 20 : 24,
          overflow: 'hidden',
          background: 'rgba(37,99,235,0.06)',
        }}>
          {/* Ambient radial glow */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            pointerEvents: 'none', opacity: 0.7,
            backgroundImage: 'radial-gradient(60% 80% at 50% 50%, rgba(96,165,250,0.25), transparent 70%)',
          }} />
          <WaveformCanvas active={waveActive} intensity={waveIntensity} phase={wavePhase} />
        </div>

        {/* Controls column: pause (optional) + mic button — hidden when parent handles controls */}
        {!hideControls && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>

          {/* Pause / Resume — appears after first click */}
          {hasStarted && (
            <button
              onClick={isPaused ? handleResume : handlePause}
              disabled={isProcessing}
              aria-label={isPaused ? 'Resume microphone' : 'Pause microphone'}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                border: '1.5px solid rgba(232,228,222,0.9)',
                background: 'rgba(254,253,251,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isProcessing ? 'default' : 'pointer',
                opacity: isProcessing ? 0.4 : 1,
                boxShadow: '0 2px 4px rgba(61,67,88,0.04), 0 8px 24px -12px rgba(61,67,88,0.12)',
                transition: 'transform 0.2s, opacity 0.2s',
                outline: 'none', flexShrink: 0,
              }}
            >
              {isPaused
                ? /* Play / Resume */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polygon points="5,3 19,12 5,21" fill="#2563eb" />
                  </svg>
                : /* Pause */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="5"  y="3" width="4" height="18" rx="1.5" fill="#717a8b" />
                    <rect x="15" y="3" width="4" height="18" rx="1.5" fill="#717a8b" />
                  </svg>
              }
            </button>
          )}

          {/* ── Main mic button (72 × 72 circle) ── */}
          <button
            onClick={handleMicClick}
            disabled={isDisabled}
            aria-label="Toggle microphone"
            aria-pressed={isListening}
            className={isListening ? 'vm-pulse-glow' : ''}
            style={{
              position: 'relative',
              width: 72, height: 72, borderRadius: '50%',
              border: 'none', outline: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: !authed ? 0.6 : 1,
              backgroundImage: isPaused || !authed
                ? 'linear-gradient(135deg, #d1cfc9, #e8e4de)'
                : 'linear-gradient(135deg, #2563eb, #60a5fa)',
              boxShadow: '0 2px 4px rgba(61,67,88,0.04), 0 18px 40px -18px rgba(61,67,88,0.18)',
              transition: 'transform 0.2s, opacity 0.2s',
              flexShrink: 0,
            }}
          >
            {/* Gloss sheen */}
            <span aria-hidden style={{
              pointerEvents: 'none',
              position: 'absolute', inset: 0, borderRadius: '50%',
              opacity: 0.5,
              backgroundImage: 'radial-gradient(120% 80% at 30% 10%, rgba(255,255,255,0.45), transparent 60%)',
            }} />

            {/* Icon — MicOff when paused, Mic otherwise */}
            {isPaused
              ? /* MicOff */
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                     style={{ color: '#717a8b', position: 'relative' }}>
                  <line x1="2" y1="2" x2="22" y2="22"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="22"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  <line x1="8"  y1="22" x2="16" y2="22"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              : /* Mic */
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                     style={{ color: '#fefefe', position: 'relative' }}>
                  <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" />
                  <path d="M5 11a7 7 0 0 0 14 0"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                  <line x1="12" y1="18" x2="12" y2="22"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  <line x1="8"  y1="22" x2="16" y2="22"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
            }
          </button>

        </div>}  {/* end {!hideControls && <div controls>} */}
      </div>

      {/* ── Status pill — only when not managed by parent ── */}
      {!hideControls && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px',
          borderRadius: 20,
          background: 'rgba(254,253,251,0.85)',
          boxShadow: '0 1px 2px rgba(61,67,88,0.04), 0 8px 24px -12px rgba(61,67,88,0.1)',
          backdropFilter: 'blur(6px)',
        }}>
          <span
            className={isListening || isProcessing ? 'vm-dot-pulse' : ''}
            style={{
              display: 'inline-block',
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: isListening  ? '#2563eb'
                        : isStreaming   ? '#60a5fa'
                        : isProcessing  ? '#717a8b'
                        :                 '#c5bfb8',
            }}
          />
          <span style={{
            fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
            color: isListening ? '#2563eb' : isStreaming ? '#3d4358' : '#717a8b',
          }}>
            {stateLabel}
          </span>
        </div>
      )}

      {/* ── Reconnecting banner ── */}
      {isReconnecting && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 14px', borderRadius: 20,
          background: 'rgba(212,137,42,0.1)',
          border: '1px solid rgba(212,137,42,0.25)',
          fontSize: 11, color: '#b87010',
        }}>
          <div className="vm-spin" style={{
            width: 8, height: 8, flexShrink: 0, borderRadius: '50%',
            border: '1.5px solid rgba(212,137,42,0.25)',
            borderTopColor: '#d4892a',
          }} />
          Reconnecting…
        </div>
      )}

    </div>
  );
});

export default VoiceMic;
