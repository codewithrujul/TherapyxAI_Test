/**
 * ChatBox.jsx
 *
 * Full WhatsApp-style chat panel:
 *   • Top area  — scrollable message bubbles (matches voice transcript style)
 *   • Bottom    — themed input bar with send button
 *
 * WebSocket / audio pipeline logic is unchanged from the original.
 * Only the UI layer has been rebuilt to match the design system.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE } from '../config';

const MS = { IDLE: 'idle', WAITING: 'waiting', STREAMING: 'streaming' };

export default function ChatBox({
  wsUrl        = `${WS_BASE}/ws/chat`,
  token        = '',
  sessionId    = '',
  languageCode = 'en-IN',
  guestId      = '',
  guestName    = '',
  reason       = '',
  onDone,
  onError,
}) {
  // ── Conversation state ───────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState([]);  // { role: 'user'|'ai', text }
  const messagesRef     = useRef([]);                      // mirror for stale-closure-safe reads
  const [streamingText, setStreamingText] = useState('');  // live token accumulation
  const streamingRef    = useRef('');

  // ── Connection state ─────────────────────────────────────────────────────────
  const [authed,         setAuthed]         = useState(false);
  const [chatState,      setChatState]      = useState(MS.IDLE);
  const [inputVal,       setInputVal]       = useState('');
  const [audioActive,    setAudioActive]    = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const wsRef        = useRef(null);
  const authedRef    = useRef(false);
  const chatStateRef = useRef(MS.IDLE);
  const inputRef     = useRef(null);
  const scrollEndRef = useRef(null);

  // ── Reconnect ────────────────────────────────────────────────────────────────
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef   = useRef(null);
  const intentionalCloseRef = useRef(false);
  const connectRef          = useRef(null);
  const RECONNECT_BACKOFF   = [1000, 2000, 4000, 8000, 15000];
  const MAX_RECONNECT       = 8;

  // ── Audio pipeline ───────────────────────────────────────────────────────────
  const audioCtxRef      = useRef(null);
  const audioQueueRef    = useRef([]);
  const playHeadRef      = useRef(0);
  const totalChunksRef   = useRef(null);
  const isPlayingRef     = useRef(false);
  const audioFinishedRes = useRef(null);
  const audioFinished    = useRef(Promise.resolve());

  // Keep ref in sync for stale-closure-safe reads (e.g. auth:success greet guard)
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const setChatStateBoth = (s) => { chatStateRef.current = s; setChatState(s); };

  const getAudioCtx = () => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtxRef.current;
  };

  const resetAudio = () => {
    audioQueueRef.current    = [];
    isPlayingRef.current     = false;
    playHeadRef.current      = 0;
    totalChunksRef.current   = null;
    audioFinishedRes.current = null;
    audioFinished.current    = new Promise(res => { audioFinishedRes.current = res; });
    setAudioActive(false);
  };

  const stopAllAudio = useCallback(() => {
    audioQueueRef.current    = [];
    isPlayingRef.current     = false;
    playHeadRef.current      = 0;
    totalChunksRef.current   = null;
    audioFinishedRes.current?.();
    setAudioActive(false);
  }, []);

  const decodeChunk = (b64) => {
    const ctx   = getAudioCtx();
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return ctx.decodeAudioData(bytes.buffer);
  };

  const playBuffer = (buf) => new Promise(res => {
    const ctx = getAudioCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    src.onended = res; src.start();
  });

  const checkAllPlayed = useCallback(() => {
    if (
      totalChunksRef.current !== null &&
      playHeadRef.current >= totalChunksRef.current &&
      audioQueueRef.current.length === 0 &&
      !isPlayingRef.current
    ) {
      audioFinishedRes.current?.();
      setAudioActive(false);
    }
  }, []);

  const drainAudioQueue = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setAudioActive(true);
    while (true) {
      const idx = audioQueueRef.current.findIndex(e => e.seq === playHeadRef.current);
      if (idx === -1) break;
      const entry = audioQueueRef.current.splice(idx, 1)[0];
      let buf;
      try   { buf = await entry.promise; }
      catch { playHeadRef.current++; continue; }
      try   { await playBuffer(buf); }
      catch {}
      playHeadRef.current++;
    }
    isPlayingRef.current = false;
    checkAllPlayed();
  }, [checkAllPlayed]);

  // ── Message handler ──────────────────────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    switch (msg.type) {

      case 'auth:success':
        authedRef.current = true;
        setAuthed(true);
        setChatStateBoth(MS.IDLE);
        setIsReconnecting(false);
        reconnectAttemptRef.current = 0;
        setTimeout(() => inputRef.current?.focus(), 100);
        // Ask backend to initiate the greeting (streams tokens + audio back)
        // Only on fresh sessions — skip if the conversation already has messages
        if (messagesRef.current.length === 0) {
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'greet' }));
              setChatStateBoth(MS.WAITING);
            }
          }, 300);
        }
        break;

      case 'error':
        stopAllAudio();
        setChatStateBoth(MS.IDLE);
        onError?.(msg.message || msg.text || 'Unknown error');
        break;

      case 'token': {
        // Accumulate token text and show live in streaming bubble
        const tok = msg.text ?? msg.token ?? '';
        streamingRef.current += tok;
        setStreamingText(streamingRef.current);
        if (chatStateRef.current !== MS.STREAMING)
          setChatStateBoth(MS.STREAMING);
        break;
      }

      case 'audio':
        // Ignore audio in chat sessions; chat should remain text-only.
        break;

      case 'done': {
        // Flush streamed text into messages history
        const finalText = streamingRef.current.trim();
        if (finalText) {
          setMessages(prev => [...prev, { role: 'ai', text: finalText }]);
        }
        setStreamingText('');
        streamingRef.current = '';

        totalChunksRef.current = msg.totalChunks ?? null;
        if (!totalChunksRef.current || totalChunksRef.current === 0) {
          audioFinishedRes.current?.();
          setAudioActive(false);
        } else {
          checkAllPlayed();
        }
        audioFinished.current.then(() => {
          setChatStateBoth(MS.IDLE);
          setTimeout(() => inputRef.current?.focus(), 80);
        });
        onDone?.();
        break;
      }

      default: break;
    }
  }, [stopAllAudio, drainAudioQueue, checkAllPlayed, onError, onDone]);

  // ── Connect (with auto-reconnect) ────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!token && (!guestId || !guestName)) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      const old = wsRef.current;
      old.onopen = null; old.onmessage = null;
      old.onerror = null; old.onclose  = null;
      old.close();
    }
    wsRef.current = null;
    authedRef.current = false;
    setAuthed(false);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        onError?.('Connection timeout');
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      if (guestId && guestName) {
        ws.send(JSON.stringify({
          type: 'auth',
          guest_id: guestId,
          guest_name: guestName,
          languageCode,
          reason,
        }));
      } else {
        ws.send(JSON.stringify({ type: 'auth', token, languageCode, sessionId, reason }));
      }
    };
    ws.onmessage = ({ data }) => {
      let msg; try { msg = JSON.parse(data); } catch { return; }
      handleMessage(msg);
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      authedRef.current = false;
      setAuthed(false);
      setChatStateBoth(MS.IDLE);
      stopAllAudio();
      if (!intentionalCloseRef.current) {
        const attempt = reconnectAttemptRef.current;
        if (attempt < MAX_RECONNECT) {
          setIsReconnecting(true);
          const delay = RECONNECT_BACKOFF[Math.min(attempt, RECONNECT_BACKOFF.length - 1)];
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptRef.current += 1;
            connectRef.current?.();
          }, delay);
        } else {
          setIsReconnecting(false);
          onError?.('Connection lost. Please refresh the page.');
        }
      }
    };
    ws.onerror = () => { clearTimeout(timeout); };
  }, [wsUrl, token, sessionId, languageCode, guestId, guestName, reason, handleMessage, stopAllAudio, onError]);

  useEffect(() => { connectRef.current = connect; }, [connect]);

  useEffect(() => {
    reconnectAttemptRef.current = 0;
    connect();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      stopAllAudio();
      wsRef.current?.close();
    };
  }, [wsUrl, token, sessionId, languageCode, guestId, guestName]);

  // ── Send ─────────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = inputVal.trim();
    if (!text || !authedRef.current) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (chatStateRef.current !== MS.IDLE) return;

    // Add user bubble immediately
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInputVal('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    wsRef.current.send(JSON.stringify({ type: 'chat_message', text }));
    setChatStateBoth(MS.WAITING);
    setStreamingText('');
    streamingRef.current = '';
    resetAudio();
  }, [inputVal]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  // Textarea is disabled only while WAITING (no response yet) — during STREAMING
  // the user can type ahead while AI is speaking; send is blocked until AI finishes.
  const isBusy        = chatState === MS.WAITING || chatState === MS.STREAMING;
  const inputDisabled = !authed || chatState === MS.WAITING;
  const canSend       = authed && chatState === MS.IDLE && inputVal.trim().length > 0;

  const inputPlaceholder = isReconnecting    ? 'Reconnecting…'
    : !authed                                ? 'Connecting…'
    : chatState === MS.WAITING               ? 'Waiting for response…'
    : chatState === MS.STREAMING             ? 'Type your next message…'
    :                                          'Message Therapyxai…';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3 min-h-0">

        {/* Empty state */}
        {messages.length === 0 && !streamingText && !isBusy && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              {/* Leaf icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full"
                   style={{ background: 'rgb(var(--c-primary) / 0.1)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     style={{ color: 'var(--cp)' }}>
                  <path d="M17 8C8 10 5.9 16.17 3.82 19.07L5 19c.5 0 1.4-.2 2-.8 1-1 2.5-2.5 4-4 .9-.9 2.1-1.5 3.5-1.5s2.6.6 3.5 1.5c1 1 1 2.5 0 3.5S16 19 15 19H3"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                {isReconnecting ? 'Reconnecting to Therapyxai…' : !authed ? 'Connecting…' : 'Say something to begin.'}
              </p>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => {
          const isAI   = msg.role === 'ai';
          const prevRole = i > 0 ? messages[i - 1].role : null;
          const showHint = prevRole !== msg.role;

          return (
            <div key={i} className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
              {/* Speaker hint — only on first bubble in a run */}
              {showHint && (
                <div className={`flex items-center gap-1.5 mb-1 px-1 ${isAI ? '' : 'flex-row-reverse'}`}>
                  {isAI && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                         className="text-primary opacity-60">
                      <path d="M17 8C8 10 5.9 16.17 3.82 19.07L5 19c.5 0 1.4-.2 2-.8 1-1 2.5-2.5 4-4 .9-.9 2.1-1.5 3.5-1.5s2.6.6 3.5 1.5c1 1 1 2.5 0 3.5S16 19 15 19H3"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    {isAI ? 'Therapyxai' : 'You'}
                  </span>
                </div>
              )}

              {/* Bubble */}
              {isAI ? (
                <div className="max-w-[88%] text-foreground"
                     style={{
                       fontFamily:    'Lora, Georgia, serif',
                       fontSize:       15,
                       lineHeight:     1.85,
                       letterSpacing: '-0.01em',
                       padding:       '14px 18px',
                       borderRadius:  '4px 20px 20px 20px',
                       background:    'rgb(var(--c-primary) / 0.07)',
                     }}>
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[82%] text-foreground"
                     style={{
                       fontFamily:  'DM Sans, ui-sans-serif, sans-serif',
                       fontSize:     14,
                       lineHeight:   1.6,
                       padding:     '11px 15px',
                       borderRadius:'20px 4px 20px 20px',
                       background:  'rgb(var(--c-secondary))',
                     }}>
                  {msg.text}
                </div>
              )}
            </div>
          );
        })}

        {/* Live streaming AI bubble */}
        {streamingText && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-primary opacity-60">
                <path d="M17 8C8 10 5.9 16.17 3.82 19.07L5 19c.5 0 1.4-.2 2-.8 1-1 2.5-2.5 4-4 .9-.9 2.1-1.5 3.5-1.5s2.6.6 3.5 1.5c1 1 1 2.5 0 3.5S16 19 15 19H3"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[10px] text-muted-foreground/70 font-medium">Therapyxai</span>
            </div>
            <div className="max-w-[88%] text-foreground"
                 style={{
                   fontFamily:    'Lora, Georgia, serif',
                   fontSize:       15,
                   lineHeight:     1.85,
                   letterSpacing: '-0.01em',
                   padding:       '14px 18px',
                   borderRadius:  '4px 20px 20px 20px',
                   background:    'rgb(var(--c-primary) / 0.07)',
                 }}>
              {streamingText}
              {/* Blinking cursor at end of stream */}
              <span className="inline-block w-0.5 h-[1em] ml-0.5 align-text-bottom rounded-sm animate-dot-pulse"
                    style={{ background: 'var(--cp)', verticalAlign: 'text-bottom' }} />
            </div>
          </div>
        )}

        {/* Breathing presence orb — while waiting for first token */}
        {chatState === MS.WAITING && !streamingText && (
          <div className="flex items-start pl-1">
            <div className="animate-breathe flex items-center justify-center rounded-full"
                 style={{ width: 38, height: 38, background: 'rgb(var(--c-primary) / 0.1)' }}>
              <div className="animate-breathe rounded-full"
                   style={{ width: 14, height: 14, background: 'rgb(var(--c-primary) / 0.45)', animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Audio playing indicator */}
        {audioActive && !isBusy && (
          <div className="flex items-center gap-1.5 pl-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-dot-pulse" />
            <span className="text-[11px] text-muted-foreground">Speaking…</span>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="shrink-0 border-t border-border/40 px-4 py-3">
        <div className="flex items-end gap-3 rounded-2xl glass-card px-4 py-2.5">

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={inputDisabled}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/60 disabled:opacity-50"
            style={{
              fontFamily:   'DM Sans, ui-sans-serif, sans-serif',
              fontSize:      14,
              lineHeight:    1.6,
              maxHeight:     100,
              overflowY:    'auto',
              padding:      '3px 0',
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
          />

          {/* Status dot */}
          {isReconnecting && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-amber-400 animate-dot-pulse" />
          )}
          {chatState === MS.WAITING && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-primary animate-dot-pulse" />
          )}

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!canSend}
            aria-label="Send message"
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl transition-all disabled:opacity-30 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            style={{
              background: canSend ? 'var(--gradient-primary)' : 'rgb(var(--c-secondary))',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 style={{ color: canSend ? '#fff' : 'rgb(var(--c-muted-foreground))' }}>
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
