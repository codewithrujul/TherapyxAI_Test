import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ChatBox from '../components/ChatBox';
import VoiceMic, { primeMicrophoneStream } from '../components/VoiceMic';
import { isTokenExpired, AuthModal } from '../components/AuthModal';
import GuestNameModal from '../components/GuestNameModal';
import SessionReflectionNotice from '../components/SessionReflectionNotice';
import GuestReflectionOffer from '../components/GuestReflectionOffer';
import {
  linkGuestSessions, recordGuestConsent, fetchGuestReflectionOffer,
  declineGuestReflections, takeReflectionNoticeFlag,
} from '../utils/guestReflections';
import {
  EditProfileModal,
  OptionalProfileOnboarding,
} from '../components/profile-onboarding';
import { PaletteToggle, ThemeIconToggle, usePalette, PALETTES } from '../palette';

import { API_BASE, WS_BASE } from '../config';
import TherapixIcon from "../components/TherapixIcon.jsx";
import TherapistCarousel from '../components/therapist/TherapistCarousel';
import UserMenu from '../components/UserMenu';
import DifferentiatorsCarousel from '../components/wellness/DifferentiatorsCarousel';
import ClientVoiceSection from '../components/wellness/ClientVoiceSection';
import QuickCalmCard from '../components/wellness/QuickCalmCard';
import EmpathyCommunityCard from '../components/wellness/EmpathyCommunityCard';
import BannerImageCard from '../components/wellness/BannerImageCard';
import PlatformFeedbackModal from '../components/wellness/PlatformFeedbackModal';
import AIConsentModal from '../components/wellness/AIConsentModal';
import {isMagicLinkRedirect, supabase} from "../lib/supabaseClient.js";
import { trackCustomEvent } from '../lib/pixel';
import {
  isSoundEnabled, setSoundEnabled,
  playSessionStart, playSessionEnd, playTick, playPop, playComplete,
  hapticTap, hapticPhase, hapticStart, hapticEnd,
} from '../lib/feedback';
const TAB = { VOICE: 'voice', CHAT: 'chat' };

const LANGUAGES = [
  { code: 'en-IN', label: 'English', native: 'EN' },
  { code: 'hi-IN', label: 'Hindi',   native: 'हि' },
  { code: 'mr-IN', label: 'Marathi', native: 'म'  },
];

const MOODS = [
  { score: 5, emoji: '🌞', label: 'Great' },
  { score: 4, emoji: '🙂', label: 'Good'  },
  { score: 3, emoji: '😌', label: 'Okay'  },
  { score: 2, emoji: '🌧️', label: 'Low'   },
  { score: 1, emoji: '😔', label: 'Tough' },
];

const EMPTY_PROFILE = {
  gender: null,
  profession: null,
  ageGroup: null,
  onboardingCompleted: false,
  onboardingSkipped: false,
  isComplete: false,
  completionPercentage: 0,
};

function getMissingProfileFields(profile) {
  if (!profile) return ['gender', 'profession', 'ageGroup'];
  return ['gender', 'profession', 'ageGroup'].filter((field) => !profile[field]);
}

function wakeBackend() {
  // /health does a lightweight DB probe — warms the Supabase connection pool
  // so it's ready by the time the user finishes the setup modal and auth fires.
  fetch(`${API_BASE}/health`).catch(() => {});
}

async function fetchUserProfile(token) {
  const res = await fetch(`${API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  return data.profile ?? EMPTY_PROFILE;
}

async function saveUserProfile(token, payload) {
  const res = await fetch(`${API_BASE}/profile`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  const data = await res.json();
  return data.profile ?? EMPTY_PROFILE;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function MicIcon({ active, color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         style={{ color: color ?? (active ? 'var(--cp)' : 'rgb(var(--c-muted-foreground))') }}>
      <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function ChatIcon({ active, color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         style={{ color: color ?? (active ? 'var(--cp)' : 'rgb(var(--c-muted-foreground))') }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Sound mute toggle — icon-only, mirrors ThemeIconToggle's pattern ─────────
function SoundToggle({ className = '' }) {
  const [on, setOn] = useState(() => isSoundEnabled());

  function toggle() {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
    if (next) playPop(); // quick confirmation tone so you hear it turn on
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={on ? 'Mute sound' : 'Unmute sound'}
      aria-label={on ? 'Mute sound' : 'Unmute sound'}
      aria-pressed={on}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 glass-card text-muted-foreground transition-all duration-250 hover:text-foreground ${className}`}
    >
      {on ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polygon points="4 9 8 9 12 5 12 19 8 15 4 15 4 9" fill="currentColor" stroke="none"/>
          <path d="M16 8a5 5 0 0 1 0 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polygon points="4 9 8 9 12 5 12 19 8 15 4 15 4 9" fill="currentColor" stroke="none"/>
          <line x1="16" y1="9" x2="21" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="21" y1="9" x2="16" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

function TrendingUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Sidebar cards ─────────────────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MoodTrendCard({ token }) {
  const [sessions, setSessions] = useState(null); // null = loading

  useEffect(() => {
    if (!token) { setSessions([]); return; }
    fetch(`${API_BASE}/session/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { sessions: [] })
      .then(data => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]));
  }, [token]);

  // Last 7 sessions — prefer mood_checkout (post-session) as it shows Therapyxai's impact
  // falls back to mood_checkin if checkout not recorded (older sessions / skipped)
  const moodSessions = (sessions ?? [])
    .filter(s => s.mood_checkout ?? s.mood_checkin)
    .slice(-7);

  const loading  = sessions === null;
  const hasData  = moodSessions.length >= 2;

  // SVG chart dimensions
  const W = 220, H = 70, MAX = 5, MIN = 1;

  const pts = moodSessions.map((s, i) => {
    const score = s.mood_checkout ?? s.mood_checkin;
    const x = moodSessions.length === 1 ? W / 2 : (i / (moodSessions.length - 1)) * W;
    const y = H - ((score - MIN) / (MAX - MIN)) * H;
    const label = s.start_time
      ? DAY_LABELS[new Date(s.start_time).getDay()]
      : `#${i + 1}`;
    return { x, y, label, score };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = hasData
    ? `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`
    : '';

  // Latest mood delta vs previous for subtitle
  const delta = moodSessions.length >= 2
    ? pts[pts.length - 1].score - pts[pts.length - 2].score
    : null;
  const deltaLabel = delta === null ? null
    : delta > 0 ? `↑ up ${delta} from last`
    : delta < 0 ? `↓ down ${Math.abs(delta)} from last`
    : '→ same as last';
  const deltaColor = delta > 0 ? '#16a34a' : delta < 0 ? '#ef4444' : 'var(--c-muted-foreground, #7a7871)';

  return (
    <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl glass-card p-5 transition-all duration-300 hover:shadow-elevated">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="label-section text-muted-foreground" style={{ marginBottom: 2 }}>Recent sessions</p>
          <h3 className="font-sans mt-0.5 text-lg font-semibold text-foreground">Mood trend</h3>
          {deltaLabel && (
            <p className="mt-0.5 text-[11px] font-medium" style={{ color: deltaColor }}>
              {deltaLabel} session
            </p>
          )}
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <TrendingUpIcon />
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-end gap-2">
        {loading ? (
          /* Skeleton shimmer */
          <div className="flex flex-col gap-2">
            <div className="h-[70px] w-full animate-pulse rounded-xl bg-border/40" />
            <div className="flex justify-between px-0.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-2 w-4 animate-pulse rounded bg-border/40" />
              ))}
            </div>
          </div>
        ) : !hasData ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80">
              <TrendingUpIcon />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {moodSessions.length === 1
                ? 'Complete one more session to see your trend'
                : 'Complete sessions to see your mood trend'}
            </p>
          </div>
        ) : (
          /* Real chart */
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="moodAreaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="var(--cp)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--cp)" stopOpacity="0"   />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#moodAreaGrad)" />
              <path d={linePath} fill="none" stroke="var(--cp)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y}
                        r={i === pts.length - 1 ? 4 : 2.5}
                        fill="var(--cp)"
                        stroke="var(--cbg)"
                        strokeWidth={i === pts.length - 1 ? 2 : 1} />
              ))}
            </svg>
            <div className="flex justify-between px-0.5 text-[10px] font-medium text-muted-foreground">
              {pts.map((p, i) => <span key={i}>{p.label}</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}



// ─── Post-session mood check ──────────────────────────────────────────────────
function MoodCheckoutScreen({ moodBefore, onSelect, onSkip, isGuest, onSignIn }) {
  const [picked, setPicked] = useState(null);

  function choose(score, optionId) {
    playPop();
    hapticTap();
    setPicked(optionId);
    setTimeout(() => onSelect(score), 280); // brief highlight before advancing
  }

  const OPTIONS = [
    { id: 'better', label: 'A little better', score: 5 },
    { id: 'same',   label: 'About the same', score: 3 },
    { id: 'worse',  label: 'A little worse',  score: 1 },
    { id: 'unsure', label: "I'm not sure",    score: 3 },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4"
      style={{ background: 'rgba(248,250,252,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="glass-card relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl p-6 sm:p-7 text-center shadow-elevated animate-fade-up">

        {/* Soft pulse leaf icon */}
        <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
          <span className="absolute inset-0 rounded-full bg-cyan-500/15 animate-breathe" />
          <span className="absolute rounded-full bg-cyan-500/20 animate-breathe"
                style={{ width: 50, height: 50, animationDelay: '300ms' }} />
          <span className="relative text-2xl">🌿</span>
        </div>

        {/* Heading */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            SESSION COMPLETE
          </p>
          <h2 className="font-sans font-bold text-foreground text-xl sm:text-2xl tracking-tight">
            How do you feel now?
          </h2>
        </div>

        {/* Options list matching the design */}
        <div className="flex flex-col gap-2.5 w-full my-1">
          {OPTIONS.map((opt) => {
            const isSelected = picked === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(opt.score, opt.id)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/10 shadow-sm text-foreground font-semibold'
                    : 'border-border/60 hover:border-cyan-500/50 hover:bg-muted/40 text-foreground/90'
                }`}
              >
                <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-muted-foreground/40'
                }`}>
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-xs sm:text-sm font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Skip */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline transition-colors mt-1"
        >
          Skip this check-in
        </button>

        {/* Guest upsell — sign in to unlock the full experience */}
        {isGuest && (
          <div className="flex w-full flex-col items-center gap-3 border-t border-border/50 pt-4 mt-2">
            <p className="text-xs font-medium text-muted-foreground">Want to see more features?</p>
            <button
              type="button"
              onClick={onSignIn}
              className="w-full py-2.5 px-6 rounded-full text-xs font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-95"
              style={{ backgroundImage: 'var(--gradient-primary)' }}
            >
              Sign in / Sign up
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Session closure screen ───────────────────────────────────────────────────
const CLOSURE_AFFIRMATIONS = [
  'You showed up for yourself today.',
  'Every conversation is a step forward.',
  'Taking time for your mind takes courage.',
  'You deserve to feel heard, and today, you were.',
  'Small steps add up. You took one today.',
];

function ClosureScreen({ durationSecs, moodBefore, moodAfter, onDone, onHistory }) {
  const beforeMood  = MOODS.find(m => m.score === moodBefore);
  const afterMood   = MOODS.find(m => m.score === moodAfter);
  const mins        = Math.floor(durationSecs / 60);
  const secs        = durationSecs % 60;
  const durLabel    = mins > 0 ? `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim() : `${secs}s`;
  const affirmation = CLOSURE_AFFIRMATIONS[mins % CLOSURE_AFFIRMATIONS.length];

  // Mood shift label shown when both moods are present
  const delta = (moodAfter != null && moodBefore != null) ? moodAfter - moodBefore : null;
  const shiftLabel = delta === null  ? null
    : delta > 0  ? `Feeling better after your session ↑`
    : delta < 0  ? `Some sessions are harder, and that's okay`
    : `Steady through the session`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16 animate-fade-up">

      {/* Logo pulse */}
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        <span className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" />
        <span className="absolute rounded-full bg-primary/15 animate-breathe"
              style={{ width: 88, height: 88, animationDelay: '300ms' }} />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-elevated"
              style={{ backgroundImage: 'var(--gradient-primary)' }}>
          <TherapixIcon size={32} variant="white" />
        </span>
      </div>

      {/* Main message */}
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="label-section text-primary">Session complete</p>
        <h2 className="font-display italic font-light text-foreground"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', lineHeight: 1.06, letterSpacing: '-0.03em' }}>
          Take a breath.
        </h2>
        <p className="text-body max-w-xs text-muted-foreground">
          {affirmation}
        </p>
      </div>

      {/* Stats chips */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {/* Duration */}
        {durationSecs > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm shadow-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="font-semibold text-foreground">{durLabel}</span>
            <span className="text-muted-foreground">session</span>
          </div>
        )}

        {/* Mood before → after */}
        {(beforeMood || afterMood) && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-5 py-3 text-sm shadow-soft w-full justify-center flex-wrap">
            {beforeMood && (
              <span className="flex items-center gap-1.5">
                <span>{beforeMood.emoji}</span>
                <span className="text-muted-foreground text-xs">Before</span>
                <span className="font-medium text-foreground">{beforeMood.label}</span>
              </span>
            )}
            {beforeMood && afterMood && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/50 shrink-0">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {afterMood && (
              <span className="flex items-center gap-1.5">
                <span>{afterMood.emoji}</span>
                <span className="text-muted-foreground text-xs">After</span>
                <span className="font-medium text-foreground">{afterMood.label}</span>
              </span>
            )}
          </div>
        )}

        {/* Mood shift message */}
        {shiftLabel && (
          <p className="text-xs text-center font-medium"
             style={{ color: delta > 0 ? '#16a34a' : delta < 0 ? '#9b6f4b' : 'var(--c-muted-foreground, #7a7871)' }}>
            {shiftLabel}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <button
          onClick={onDone}
          className="w-full rounded-2xl py-3 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundImage: 'var(--gradient-primary)' }}
        >
          Return home
        </button>
        <button
          onClick={onHistory}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          View session history
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground">
        Not a substitute for professional care. Crisis? Call iCall:{' '}
        <a href="tel:18005990019" className="hover:underline">1800-599-0019</a>
      </p>
    </div>
  );
}

// ─── Toast — top-centre pop message, auto-dismisses after 3.5 s ──────────────
function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      className="fixed top-5 left-1/2 z-[200] -translate-x-1/2 animate-fade-up"
      role="alert"
      aria-live="assertive"
    >
      <div
        className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-elevated"
        style={{
          background:  'rgb(var(--c-foreground))',
          color:       'rgb(var(--c-background))',
          minWidth:    'min(240px, 90vw)',
          maxWidth:    'min(360px, 90vw)',
        }}
      >
        {/* Warning icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.8 }}>
          <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
        <span className="flex-1 leading-snug">{message}</span>
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Dismiss"
          style={{ opacity: 0.6 }}
          className="hover:opacity-100 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

const REASON_OPTIONS = [
  { id: 'happy', icon: '😄', title: 'Happy' },
  { id: 'worried', icon: '😥', title: 'Worried' },
  { id: 'stressed', icon: '😰', title: 'Stressed' },
  { id: 'relaxed', icon: '😎', title: 'Relaxed' },
  { id: 'sad', icon: '😞', title: 'Sad' },
  { id: 'angry', icon: '😠', title: 'Angry' },
  { id: 'overwhelmed', icon: '🌊', title: 'Overwhelmed' },
  { id: 'normal', icon: '😐', title: 'Normal' },
  { id: 'not_sure', icon: '😑', title: 'Not sure' },
];

// ─── Session Setup Modal (Language Selection) ───────────────────────────
function SessionSetupModal({ open, preferTab, onStart, onClose }) {
  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        backgroundColor: 'rgba(248,250,252,0.78)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="glass-card"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 430, borderRadius: 24, overflow: 'hidden' }}
      >
        {/* ── Header + close ── */}
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="label-section text-muted-foreground" style={{ margin: 0 }}>
            {preferTab === TAB.CHAT ? 'Chat Session' : 'Voice Session'}
          </p>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full border border-border/40 text-muted-foreground transition-colors hover:text-foreground"
            style={{ width: 30, height: 30, flexShrink: 0, background: 'transparent', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="6"  y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Language Selection ── */}
        <div style={{ padding: '12px 20px 24px' }}>
          <h3 className="font-display font-bold text-foreground" style={{ fontSize: '1.45rem', lineHeight: 1.2, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
            Choose your language
          </h3>
          <p className="text-muted-foreground" style={{ fontSize: 13, margin: '0 0 16px' }}>
            Select your preferred language to start session.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  playPop();
                  hapticTap();
                  onStart(lang.code, 3, preferTab || TAB.VOICE);
                }}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border/50 px-4 py-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
                style={{ background: 'transparent', cursor: 'pointer' }}
              >
                <span className="text-primary font-bold" style={{ fontSize: 17, width: 28, flexShrink: 0, textAlign: 'center' }}>{lang.native}</span>
                <span className="text-foreground font-medium" style={{ fontSize: 15 }}>{lang.label}</span>
                <svg className="ml-auto text-muted-foreground shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}





// ═════════════════════════════════════════════════════════════════════════════
export default function WellnessPage({ onOpenHistory, onOpenAppointments, onOpenTherapistProfile, onOpenTherapistBooking, onOpenTherapistDashboard, onOpenAdminDashboard, onOpenTherapistOnboarding, onOpenTherapistList, onOpenTherapistAuth, onOpenExercises, onAuthSuccess, onSignOut, onAuthClose, initialAuthOpen = false }) {
  const [sessionId,      setSessionId]      = useState(null);
  const [sessionMode,    setSessionMode]    = useState('voice'); // 'voice' | 'chat'
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionSecs,    setSessionSecs]    = useState(0);
  const [moodCheckin,    setMoodCheckin]    = useState(null);  // 1–5
  const [languageCode,   setLanguageCode]   = useState('en-IN');
  const [selectedReason, setSelectedReason] = useState(null);
  const [customReasonText, setCustomReasonText] = useState('');
  const [setupOpen,      setSetupOpen]      = useState(false);
  const [setupTab,       setSetupTab]       = useState(TAB.VOICE);
  const pendingTabRef    = useRef(null); // stores tab when guest name modal interrupts
  const [toast,          setToast]          = useState('');
  const showToast = useCallback((msg) => setToast(msg), []);
  const [micDenied,      setMicDenied]      = useState(false);
  const [sessionEnding,  setSessionEnding]  = useState(false); // 800ms breath pause on end
  const [bouncingMood,   setBouncingMood]   = useState(null);  // emoji spring animation
  // Closure flow: null → { phase:'mood', durationSecs, moodBefore, sessionId } → { phase:'closure', moodAfter, … }
  const [closureData,    setClosureData]    = useState(null);
  // Brief "reflecting on your session" notice shown after the mood check (signed-in users only)
  const [reflectionNotice, setReflectionNotice] = useState(false);
  // Guest offer: null, or { expiresInMin } while the "sign in to get reflections" dialog is open
  const [guestOffer, setGuestOffer] = useState(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingStartConfig, setPendingStartConfig] = useState(null);

  // Voice control state — fed from VoiceMic via onControlState callback
  const [voiceCtrl, setVoiceCtrl] = useState({
    isListening: false, isProcessing: false, isStreaming: false,
    isPaused: false, hasStarted: false, authed: false,
    isReconnecting: false, stateLabel: 'Tap the mic to begin',
  });
  const voiceMicRef = useRef(null);
  // Tracks whether the one-time "auto-open mic after greeting" fallback has fired this session
  const autoFirstListenRef = useRef({ fired: false, timer: null });

  // Reset the auto-listen fallback whenever the session changes
  useEffect(() => {
    const a = autoFirstListenRef.current;
    a.fired = false;
    if (a.timer) { clearTimeout(a.timer); a.timer = null; }
  }, [sessionId]);

  // Screen Wake Lock for voice sessions (prevent screen sleep/turn off)
  useEffect(() => {
    let wakeLock = null;

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('[WakeLock] Screen Wake Lock acquired.');
        }
      } catch (err) {
        console.warn('[WakeLock] Failed to request Screen Wake Lock:', err.message);
      }
    }

    function releaseWakeLock() {
      if (wakeLock !== null) {
        const lock = wakeLock;
        wakeLock = null;
        lock.release()
          .then(() => {
            console.log('[WakeLock] Screen Wake Lock released.');
          })
          .catch((err) => {
            console.warn('[WakeLock] Release failed:', err.message);
          });
      }
    }

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    if (sessionId && sessionMode === 'voice') {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [sessionId, sessionMode]);

  // Fallback: if VoiceMic's internal auto-restart doesn't open the mic after the greeting
  // (e.g. getUserMedia permission not yet cached), force-open it here after a brief delay.
  useEffect(() => {
    if (!sessionId || sessionMode !== 'voice') return;
    const a = autoFirstListenRef.current;
    if (a.fired) return;
    if (!voiceCtrl.authed || !voiceCtrl.hasStarted) return;

    if (voiceCtrl.isListening) {
      // Auto-restart succeeded — mark done and cancel any pending timer
      a.fired = true;
      if (a.timer) { clearTimeout(a.timer); a.timer = null; }
      return;
    }

    if (voiceCtrl.isStreaming || voiceCtrl.isProcessing) {
      // Greeting audio is still playing — do NOT start the timer yet, just wait.
      // Cancel any timer that fired prematurely due to React batching.
      if (a.timer) { clearTimeout(a.timer); a.timer = null; }
      return;
    }

    // IDLE after greeting audio finished — start 1 s fallback.
    // VoiceMic's own kick fires at 550 ms; if it works, isListening becomes true
    // and the branch above cancels this timer before it fires.
    if (!a.timer) {
      a.timer = setTimeout(() => {
        a.timer = null;
        if (!a.fired) {
          a.fired = true;
          voiceMicRef.current?.micClick();
        }
      }, 1000);
    }
  }, [sessionId, sessionMode, voiceCtrl.authed, voiceCtrl.hasStarted,
      voiceCtrl.isListening, voiceCtrl.isStreaming, voiceCtrl.isProcessing]);

  // Live voice transcript  { role: 'user'|'ai', text: string }
  const [messages,    setMessages]    = useState([]);
  const transcriptScrollRef           = useRef(null);
  const transcriptEndRef              = useRef(null);
  const aiBufferRef                   = useRef(''); // accumulates tokens; flushed only on done

  // Auto-scroll transcript to bottom
  useEffect(() => {
    const scroller = transcriptScrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleTranscript = useCallback((text) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
  }, []);

  // Buffer tokens silently — user listens, not reads
  const handleToken = useCallback((token) => {
    aiBufferRef.current += token;
  }, []);

  const handleVoiceError = useCallback((code) => {
    if (code === 'mic_permission_denied') setMicDenied(true);
  }, []);

  // Flush full AI response to transcript only after speech is complete
  const handleDone = useCallback(() => {
    const text = aiBufferRef.current.trim();
    if (text) {
      setMessages(prev => [...prev, { role: 'ai', text }]);
    }
    aiBufferRef.current = '';
  }, []);

  const timerRef = useRef(null);

  const [user,           setUser]           = useState(() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } });
  const [token,          setToken]          = useState(() => localStorage.getItem('accessToken') ?? '');
  const [authOpen,       setAuthOpen]       = useState(initialAuthOpen);
  const [guestTimeUp,    setGuestTimeUp]    = useState(false);

  useEffect(() => {
    setAuthOpen(Boolean(initialAuthOpen));
  }, [initialAuthOpen]);

  // Guest mode state
  const [guestName,      setGuestName]      = useState(() => localStorage.getItem('guest_name') ?? '');
  const [guestReady,     setGuestReady]     = useState(() => !!localStorage.getItem('guest_name'));
  const [showGuestModal, setShowGuestModal] = useState(false);

  // 10-min guest session timer
  const guestTimerRef   = useRef(null);
  const [guestSecsLeft, setGuestSecsLeft]  = useState(null); // null = not running

  function startGuestTimer() {
    setGuestSecsLeft(1800);
    guestTimerRef.current = setInterval(() => {
      setGuestSecsLeft(s => {
        if (s <= 1) {
          clearInterval(guestTimerRef.current);
          setGuestTimeUp(true);
          setAuthOpen(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stopGuestTimer() {
    clearInterval(guestTimerRef.current);
    setGuestSecsLeft(null);
  }

  function handleGuestStart(name) {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem('guest_id', guestId);
    }
    localStorage.setItem('guest_name', name);
    setGuestName(name);
    setGuestReady(true);
    setShowGuestModal(false);
    // Open setup modal for the tab they originally clicked
    const tab = pendingTabRef.current ?? TAB.VOICE;
    pendingTabRef.current = null;
    setSetupTab(tab);
    wakeBackend();
    setSetupOpen(true);
  }
  const [profile,        setProfile]        = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileOnboardingOpen, setProfileOnboardingOpen] = useState(false);
  const [editProfileOpen,       setEditProfileOpen]       = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const { palette, setPalette } = usePalette();

  // Header separator line — appears once the user starts scrolling (header itself stays sticky/steady)
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Session timer
  useEffect(() => {
    if (sessionId) {
      setSessionSecs(0);
      timerRef.current = setInterval(() => setSessionSecs(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setSessionSecs(0);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionId]);

  // Close mobile menu on outside click + lock body scroll while open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Ensure the SPA has an initial history entry we control
  useEffect(() => {
    try { history.replaceState(history.state ?? {}, ''); } catch (e) { /* ignore */ }
  }, []);

  // Helper to reset UI to landing view (close modals, menus, and session view)
  const resetToLandingView = useCallback(() => {
    setSetupOpen(false);
    setShowSecurityPopup(false);
    setPendingStartConfig(null);
    setShowGuestModal(false);
    setAuthOpen(false);
    setEditProfileOpen(false);
    setProfileOnboardingOpen(false);
    setMobileMenuOpen(false);
    // If a session is active, close the session view (UI only)
    if (sessionId) {
      setSessionId(null);
    }
  }, [sessionId]);

  // Intercept browser back (popstate). If any overlay or session is open,
  // navigate back to the landing UI instead of allowing the browser/app to close.
  useEffect(() => {
    const handlePop = (e) => {
      const anyOpen = setupOpen || showConsentModal || showGuestModal || authOpen || editProfileOpen || profileOnboardingOpen || mobileMenuOpen || !!sessionId;
      if (anyOpen) {
        // Close overlays / session and reinstate a history entry so back doesn't exit the app
        resetToLandingView();
        try { history.pushState({}, ''); } catch (err) { /* ignore */ }
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [setupOpen, showConsentModal, showGuestModal, authOpen, editProfileOpen, profileOnboardingOpen, mobileMenuOpen, sessionId, resetToLandingView]);

  // Push a history entry only when any overlay/session first opens so the back button
  // can be intercepted and used to return to the landing page.
  const _overlayPrevRef = useRef(false);
  useEffect(() => {
    const anyOpen = setupOpen || showGuestModal || authOpen || editProfileOpen || profileOnboardingOpen || mobileMenuOpen || !!sessionId;
    if (anyOpen && !_overlayPrevRef.current) {
      try { history.pushState({}, ''); } catch (e) { /* ignore */ }
    }
    _overlayPrevRef.current = anyOpen;
  }, [setupOpen, showGuestModal, authOpen, editProfileOpen, profileOnboardingOpen, mobileMenuOpen, sessionId]);

  const loadProfile = useCallback(async (nextToken, { showOptionalOnboarding = false } = {}) => {
    if (!nextToken) return null;
    setProfileLoading(true);
    try {
      const nextProfile = await fetchUserProfile(nextToken);
      setProfile(nextProfile);
      if (
        showOptionalOnboarding &&
        !nextProfile.onboardingCompleted &&
        !nextProfile.onboardingSkipped
      ) {
        setProfileOnboardingOpen(true);
      }
      return nextProfile;
    } catch {
      setProfile(EMPTY_PROFILE);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token || !user || isTokenExpired()) {
      setProfile(null);
      return;
    }
    loadProfile(token);
  }, [token, user, loadProfile]);

  function handleSuccess(u, options = {}) {
    const nextToken = localStorage.getItem('accessToken') ?? '';
    const isNewUser = Boolean(options.isNewUser);
    setUser(u);
    setToken(nextToken);        // was newToken
    setAuthOpen(false);
    if (isNewUser) {
      setProfile(EMPTY_PROFILE);
      setProfileOnboardingOpen(true);
    }
    loadProfile(nextToken);
    if (onAuthSuccess) {
      onAuthSuccess(u, nextToken);
    }
  }
  function handleSignOut() {
    localStorage.clear();
    setUser(null);

    setToken('');
    setProfile(null);
    setProfileOnboardingOpen(false);
    setEditProfileOpen(false);
    setSessionId(null);
    setAuthOpen(true);
    if (onSignOut) {
      onSignOut();
    }
  }

  const handleSkipProfileOnboarding = useCallback(async () => {
    setProfileOnboardingOpen(false);
    if (!token) return;
    setProfileSaving(true);
    try {
      const nextProfile = await saveUserProfile(token, { onboardingSkipped: true });
      setProfile(nextProfile);
    } catch {
      showToast('Could not save profile preference. You can update it later.');
    } finally {
      setProfileSaving(false);
    }
  }, [token]);

  const handleCompleteProfileOnboarding = useCallback(async (profileData) => {
    if (!token) return;
    setProfileSaving(true);
    try {
      const nextProfile = await saveUserProfile(token, { ...profileData, onboardingSkipped: false });
      setProfile(nextProfile);
      if (profileData.name || profileData.email) {
        setUser((prev) => prev ? {
          ...prev,
          name:  profileData.name  ?? prev.name,
          email: profileData.email ?? prev.email,
        } : prev);
      }
      setProfileOnboardingOpen(false);
    } catch {
      showToast('Could not save profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }, [token]);

  // Listen for Google OAuth redirect — Supabase fires SIGNED_IN after the redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN' || !session) return;

      const provider = session.user?.app_metadata?.provider;
      // isMagicLinkRedirect is captured at module load (before Supabase strips the hash)
      // and signals this SIGNED_IN came from our custom backend Google OAuth callback.
      // Skip if it's a regular email/password login (already handled by handleLogin/handleRegister).
      if (provider !== 'google' && !isMagicLinkRedirect) return;

      try {
        // Call backend to init credits if new user + get profile
        const res = await fetch(`${API_BASE}/auth/google-login`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Google login failed');

        // Save session in same format as email login
        localStorage.setItem('accessToken',  session.access_token);
        localStorage.setItem('refreshToken', session.refresh_token ?? '');
        localStorage.setItem('user', JSON.stringify(json.user));

        // Attach this browser's guest sessions (and reflections consent, if given) to the account
        await linkGuestSessions(session.access_token);

        // Update app state — same as email handleSuccess
        setUser(json.user);
        setToken(session.access_token);
        setAuthOpen(false);
        if (onAuthSuccess) {
          onAuthSuccess(json.user, session.access_token);
        }
      } catch (err) {
        console.error('[Google OAuth]', err.message);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  const handleSaveProfile = useCallback(async (profileData) => {
    if (!token) return;
    setProfileSaving(true);
    try {
      const nextProfile = await saveUserProfile(token, profileData);
      setProfile(nextProfile);
      if (profileData.name || profileData.email) {
        setUser((prev) => prev ? {
          ...prev,
          name:  profileData.name  ?? prev.name,
          email: profileData.email ?? prev.email,
        } : prev);
      }
      setEditProfileOpen(false);
      showToast('Profile updated.');
    } catch {
      showToast('Could not update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }, [token]);

  const handleOpenSessionSetup = useCallback((tab = TAB.VOICE, reason = null) => {
    const activeReason = reason ?? ((selectedReason === 'Other Reason' && customReasonText.trim()) ? customReasonText.trim() : selectedReason);
    if (activeReason) setSelectedReason(activeReason);
    if (!token && !guestReady) {
      pendingTabRef.current = tab;
      setShowGuestModal(true);
      return;
    }
    setSetupTab(tab);
    setSetupOpen(true);
  }, [token, guestReady, selectedReason, customReasonText]);

  const proceedStartSession = useCallback(async (preferTab, activeLang, activeMood, activeReason) => {
    playSessionStart();
    hapticStart();
    const isGuest = !token && guestReady;
    setSessionLoading(true);
    const mode = preferTab === TAB.CHAT ? 'chat' : 'voice';
    setSessionMode(mode);

    // Guest mode — session is created by the WS handler on auth, skip REST call
    if (isGuest) {
      setMessages([]);
      aiBufferRef.current = '';
      setMicDenied(false);
      setClosureData(null);
      setSessionId(`guest_${Date.now()}`); // placeholder; real ID comes from WS auth:success
      startGuestTimer();
      setSessionLoading(false);
      trackCustomEvent('StartSession', {
        mode: mode,
        language: activeLang,
        mood: activeMood,
        reason: activeReason,
        isGuest: true
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/session/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodCheckin: activeMood, languageCode: activeLang }),
      });
      if (!res.ok) throw new Error();
      const { sessionId: id } = await res.json();
      setMessages([]);
      aiBufferRef.current = '';
      setMicDenied(false);
      setClosureData(null);
      setSessionId(id);
      trackCustomEvent('StartSession', {
        mode: mode,
        language: activeLang,
        mood: activeMood,
        reason: activeReason,
        isGuest: false
      });
    } catch {
      showToast('Could not start session. Please try again.');
      setSessionLoading(false);
    } finally {
      setSessionLoading(false);
    }
  }, [token, guestReady, API_BASE, showToast, startGuestTimer]);

  const hasUserConsented = useCallback(() => {
    const key = user?.id ? `txai_ai_consent_${user.id}` : 'txai_ai_consent_guest';
    return localStorage.getItem(key) === 'true';
  }, [user]);

  const saveUserConsent = useCallback(() => {
    const key = user?.id ? `txai_ai_consent_${user.id}` : 'txai_ai_consent_guest';
    localStorage.setItem(key, 'true');
    if (user?.id) localStorage.setItem('txai_ai_consent_authed', 'true');
  }, [user]);

  const handleConsentAgree = useCallback(() => {
    saveUserConsent();
    setShowConsentModal(false);
    if (pendingStartConfig) {
      const { preferTab, activeLang, activeMood, activeReason } = pendingStartConfig;
      setPendingStartConfig(null);
      if (preferTab !== TAB.CHAT) {
        primeMicrophoneStream().catch(() => {});
      }
      proceedStartSession(preferTab, activeLang, activeMood, activeReason);
    }
  }, [saveUserConsent, pendingStartConfig, proceedStartSession]);

  const handleStartSession = useCallback(async (overrideLang, overrideMood, preferTab) => {
    const activeLang   = overrideLang ?? languageCode;
    const activeMood   = overrideMood ?? moodCheckin ?? 3;
    const activeReason = (selectedReason === 'Other Reason' && customReasonText.trim()) ? customReasonText.trim() : selectedReason;
    setLanguageCode(activeLang);
    setMoodCheckin(activeMood);
    setSetupOpen(false);

    if (!hasUserConsented()) {
      setPendingStartConfig({ preferTab, activeLang, activeMood, activeReason });
      setShowConsentModal(true);
    } else {
      if (preferTab !== TAB.CHAT) {
        primeMicrophoneStream().catch(() => {});
      }
      proceedStartSession(preferTab, activeLang, activeMood, activeReason);
    }
  }, [languageCode, moodCheckin, selectedReason, customReasonText, hasUserConsented, proceedStartSession]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    playSessionEnd();
    hapticEnd();
    stopGuestTimer();
    // Capture before clearing — needed for closure screen and mood API call
    const endedSecs       = sessionSecs;
    const endedMoodBefore = moodCheckin;
    const endedSessionId  = sessionId;
    voiceMicRef.current?.pause?.();
    setSessionEnding(true);
    setSessionId(null);
    setSessionMode('voice');

    if (!token) {
      // Guest session — WS close triggers backend cleanup of the session row itself,
      // but guests still get the same mood-checkout/closure flow as signed-in users.
      setMoodCheckin(null);
      setLanguageCode('en-IN');
      setTimeout(() => {
        setSessionEnding(false);
        setClosureData({ phase: 'mood', durationSecs: endedSecs, moodBefore: endedMoodBefore, sessionId: endedSessionId });
      }, 800);
      return;
    }

    setSessionLoading(true);
    let insightsEnabled = false;   // Backend tells us whether insights will actually be produced and shown
    try {
      const endRes = await fetch(`${API_BASE}/session/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: endedSessionId }),
      });
      if (endRes.ok) {
        const body = await endRes.json().catch(() => null);
        insightsEnabled = body?.insightsEnabled === true;
      }
    } catch {
      console.error('[WellnessPage] endSession failed');
    } finally {
      setSessionLoading(false);
      setMoodCheckin(null);
      setLanguageCode('en-IN');
      // 800ms breath pause — lets the user exhale before the mood check
      setTimeout(() => {
        setSessionEnding(false);
        setClosureData({ phase: 'mood', durationSecs: endedSecs, moodBefore: endedMoodBefore, sessionId: endedSessionId, insightsEnabled });
      }, 800);
    }
  }, [token, sessionId, sessionSecs, moodCheckin]);

  // Called when user picks (or skips) the post-session mood check
  const handleMoodCheckout = useCallback(async (score) => {
    // Signed-in users get a short "reflecting on your session" notice back on the main screen,
    // but only if the Backend says insights are on. The 20s guard skips accidental start/stops,
    // which have nothing to reflect on.
    if (token && closureData?.insightsEnabled && (closureData.durationSecs ?? 0) >= 20) {
      setReflectionNotice(true);
    }
    // Guests: ask the Backend whether a reflections offer applies (it says no when the feature is off)
    const guestIdForOffer = !token ? localStorage.getItem('guest_id') : null;
    if (guestIdForOffer && (closureData?.durationSecs ?? 0) >= 20) {
      fetchGuestReflectionOffer(guestIdForOffer).then((o) => {
        if (o?.available) setGuestOffer({ expiresInMin: o.expiresInMin ?? null });
      });
    }
    // Straight back to the main screen after feedback — no "Take a breath" closure screen.
    setClosureData(null);
    if (!score) return; // skipped — no API call
    try {
      await fetch(`${API_BASE}/session/mood-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sessionId: closureData?.sessionId,
          guestId: !token ? (localStorage.getItem('guest_id') ?? undefined) : undefined,
          moodCheckout: score,
        }),
      });
    } catch {
      console.error('[WellnessPage] mood-checkout save failed');
    }
  }, [token, closureData]);

  // Starting a new session cancels a notice that is still on screen
  useEffect(() => { if (sessionId) { setReflectionNotice(false); setGuestOffer(null); } }, [sessionId]);

  // A guest just signed in and their reflections were claimed: show the same notice as signed-in users
  useEffect(() => {
    if (token && takeReflectionNoticeFlag()) setReflectionNotice(true);
  }, [token]);

  const sessionActive = !!sessionId;
  const firstName = user?.name?.split(' ')[0] ?? (guestName ? guestName.split(' ')[0] : 'friend');
  const greeting  = getGreeting();
  const editableProfile = {
    name: profile?.name ?? user?.name ?? undefined,
    email: profile?.email ?? user?.email ?? undefined,
    languageCode: profile?.languageCode ?? undefined,
    reason: profile?.reason ?? undefined,
    gender: profile?.gender ?? undefined,
    profession: profile?.profession ?? undefined,
    ageGroup: profile?.ageGroup ?? undefined,
  };
  const openProfileDetails = () => {
    setEditProfileOpen(true);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col gap-4 sm:gap-6 lg:gap-7 px-4 pb-12 sm:px-5 lg:px-6 xl:px-8">

      {/* ── Toast ── */}
      <Toast message={toast} onClose={() => setToast('')} />

      {/* ── Header ── */}
      <header
        className={`sticky top-0 z-40 -mx-4 px-4 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 xl:-mx-8 xl:px-8 flex items-center justify-between py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm animate-fade-up transition-all duration-300 ${
          headerScrolled ? 'nav-scrolled' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <TherapixIcon size={32} variant="color" className="shrink-0" />
          <span className="font-extrabold text-base md:text-lg text-foreground tracking-tight">Therapyx<span className="gradient-text">AI</span></span>
        </div>

        <div className="flex items-center gap-2">

          {/* ── Desktop nav (sm+): all buttons visible ── */}
          <div className="hidden sm:flex items-center gap-2">
            <PaletteToggle />
            {user && (
              <button
                onClick={() => onOpenHistory?.(token)}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                History
              </button>
            )}
            {user && (
              <button
                onClick={() => onOpenAppointments?.()}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Appointments
              </button>
            )}
            {user && (
              <button
                onClick={openProfileDetails}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Profile
              </button>
            )}
            {user ? (
              <UserMenu
                user={{ ...user, role: profile?.role || 'patient' }}
                token={token}
                onSignOut={handleSignOut}
                onOpenTherapistDashboard={onOpenTherapistDashboard}
                onOpenAdminDashboard={onOpenAdminDashboard}
                onOpenTherapistOnboarding={onOpenTherapistOnboarding}
              />
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                aria-label="Sign in"
                title="Sign in"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 glass-card text-primary transition-all duration-250 hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* ── Mobile theme toggle (< sm): always visible, independent of login state ── */}
          <ThemeIconToggle className="sm:hidden" />

          {/* ── Mobile nav (< sm): avatar triggers profile dropdown ── */}
          <div className="relative sm:hidden" ref={mobileMenuRef}>
            {user ? (
              <>
                {/* Avatar trigger */}
                <button
                  onClick={() => setMobileMenuOpen(o => !o)}
                  aria-label="Open profile menu"
                  aria-expanded={mobileMenuOpen}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white transition-transform active:scale-95"
                  style={{
                    backgroundImage: 'var(--gradient-primary)',
                    boxShadow: mobileMenuOpen
                      ? '0 0 0 3px rgb(var(--c-background)), 0 0 0 5px rgb(var(--c-primary))'
                      : '0 0 0 2px rgb(var(--c-background)), 0 0 0 3.5px rgb(var(--c-primary) / 0.5)',
                  }}
                >
                  {(firstName[0] ?? 'S').toUpperCase()}
                </button>

                {/* Portal — renders into document.body, escapes header's transform stacking context */}
                {mobileMenuOpen && createPortal((() => {
                  const isLight  = palette === 'light' || palette === 'warm-dusk';
                  const cardBg   = isLight ? (palette === 'warm-dusk' ? '#fffdf9' : '#ffffff') : palette === 'bloom' ? '#0e1226' : '#121824';
                  const secBg    = isLight ? (palette === 'warm-dusk' ? '#f8f2e8' : '#f8fafc') : palette === 'bloom' ? '#12163a' : '#192234';
                  const borderC  = isLight ? (palette === 'warm-dusk' ? '#e8ddcf' : '#e2e8f0') : palette === 'bloom' ? '#1e2448' : '#212d42';
                  const textMain = isLight ? (palette === 'warm-dusk' ? '#4a3d2f' : '#0f172a') : palette === 'bloom' ? '#e8e8f8' : '#f0ede8';
                  const textSub  = isLight ? (palette === 'warm-dusk' ? '#7a6d5d' : '#64748b') : palette === 'bloom' ? '#9494af' : '#9ca3af';
                  const primary  = '#2563eb';
                  return (
                    <>
                      {/* Backdrop - covers entire page */}
                      <div onClick={() => setMobileMenuOpen(false)}
                           style={{ position: 'fixed', inset: 0, zIndex: 9998, background: isLight ? 'rgba(248,250,252,0.64)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />

                      {/* Menu — solid, on top of backdrop */}
                      <div style={{
                        position: 'fixed', right: 12, top: 68, zIndex: 9999,
                        width: 224, borderRadius: 16, overflow: 'hidden',
                        backgroundColor: cardBg,
                        border: `1px solid ${borderC}`,
                        boxShadow: isLight ? '0 1px 3px rgba(15,23,42,0.06), 0 14px 34px -24px rgba(15,23,42,0.24)' : '0 8px 32px rgba(0,0,0,0.60), 0 2px 8px rgba(0,0,0,0.40)',
                      }}>
                        {/* User info + close button */}
                        <div style={{ backgroundColor: secBg, borderBottom: `1px solid ${borderC}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{user.name}</p>
                            <p style={{ fontSize: 11, color: textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>{user.email}</p>
                          </div>
                          <button onClick={() => setMobileMenuOpen(false)}
                            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: 'none', backgroundColor: cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textSub }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>

                        {/* Theme section — vertical list */}
                        <div style={{ borderBottom: `1px solid ${borderC}`, padding: '10px 16px', backgroundColor: cardBg }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Theme</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                            {Object.values(PALETTES).map(({ id, label, dot }) => (
                              <button key={id} onClick={() => setPalette(id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                  fontSize: 13, fontWeight: palette === id ? 600 : 500,
                                  backgroundColor: palette === id ? secBg : 'transparent',
                                  color: palette === id ? textMain : textSub,
                                  textAlign: 'left', width: '100%',
                                }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0,
                                  boxShadow: palette === id ? `0 0 0 2px ${cardBg}, 0 0 0 3px ${dot}` : 'none' }} />
                                {label}
                                {palette === id && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', color: primary, flexShrink: 0 }}>
                                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* History */}
                        <button onClick={() => { setMobileMenuOpen(false); onOpenHistory?.(token); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', borderBottom: `1px solid ${borderC}`, backgroundColor: cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: textMain, textAlign: 'left' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: primary, flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          History
                        </button>

                        {/* Appointments */}
                        <button onClick={() => { setMobileMenuOpen(false); onOpenAppointments?.(); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', borderBottom: `1px solid ${borderC}`, backgroundColor: cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: textMain, textAlign: 'left' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: primary, flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          Appointments
                        </button>

                        {/* Profile */}
                        <button onClick={() => { setMobileMenuOpen(false); openProfileDetails(); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', borderBottom: `1px solid ${borderC}`, backgroundColor: cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: textMain, textAlign: 'left' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: primary, flexShrink: 0 }}>
                            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                            <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          Profile
                        </button>

                        {/* Sign out */}
                        <button onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', backgroundColor: cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#C4553A', textAlign: 'left' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Sign out
                        </button>
                      </div>
                    </>
                  );
                })(), document.body)}
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                aria-label="Sign in"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 glass-card text-primary transition-all duration-250 hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ══════════════════ SESSION ENDING — 800ms BREATH PAUSE ════════════════ */}
      {sessionEnding && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 animate-fade-up">
          <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" />
            <span className="absolute rounded-full bg-primary/15 animate-breathe"
                  style={{ width: 70, height: 70, animationDelay: '800ms' }} />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground"
                  style={{ backgroundImage: 'var(--gradient-primary)' }}>
              <TherapixIcon size={24} variant="white" />
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Take a breath…</p>
        </div>
      )}

      {/* ══════════════════ POST-SESSION MOOD CHECK ══════════════════ */}
      {closureData?.phase === 'mood' && !sessionId && !sessionLoading && !sessionEnding && (
        <MoodCheckoutScreen
          moodBefore={closureData.moodBefore}
          onSelect={(score) => handleMoodCheckout(score)}
          onSkip={() => handleMoodCheckout(null)}
          isGuest={!token}
          onSignIn={() => setAuthOpen(true)}
        />
      )}

      {/* ══════════════════ "REFLECTING ON YOUR SESSION" NOTICE (signed-in only) ══════════════════ */}
      {reflectionNotice && !!token && !sessionId && (
        <SessionReflectionNotice
          onClose={() => setReflectionNotice(false)}
          onOpenHistory={() => { setReflectionNotice(false); onOpenHistory?.(token); }}
        />
      )}

      {/* ══════════════════ GUEST: "SIGN IN TO GET REFLECTIONS" OFFER ══════════════════ */}
      {guestOffer && !token && !sessionId && (
        <GuestReflectionOffer
          expiresInMin={guestOffer.expiresInMin}
          onSignIn={() => { recordGuestConsent(); setGuestOffer(null); setAuthOpen(true); }}
          onDecline={() => {
            setGuestOffer(null);
            const gid = localStorage.getItem('guest_id');
            if (gid) declineGuestReflections(gid);
          }}
        />
      )}

      {/* ══════════════════ SESSION CLOSURE SCREEN ══════════════════ */}
      {closureData?.phase === 'closure' && !sessionId && !sessionLoading && !sessionEnding && (
        <ClosureScreen
          durationSecs={closureData.durationSecs}
          moodBefore={closureData.moodBefore}
          moodAfter={closureData.moodAfter}
          onDone={() => setClosureData(null)}
          onHistory={() => { setClosureData(null); onOpenHistory?.(token); }}
        />
      )}

      {/* ══════════════════ SESSION START TRANSITION ══════════════════ */}
      {sessionLoading && !sessionActive && !closureData && !sessionEnding && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20 animate-fade-up">
          {/* Concentric breathing rings — staggered for organic feel */}
          <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" style={{ animationDelay: '0ms' }} />
            <span className="absolute rounded-full bg-primary/15 animate-breathe" style={{ width: 104, height: 104, animationDelay: '600ms' }} />
            <span className="absolute rounded-full bg-primary/20 animate-breathe" style={{ width: 72, height: 72, animationDelay: '1200ms' }} />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground shadow-elevated"
                  style={{ backgroundImage: 'var(--gradient-primary)' }}>
              <TherapixIcon size={28} variant="white" />
            </span>
          </div>
          <div className="text-center">
            <p className="font-sans text-lg font-semibold text-foreground tracking-tight">Starting your session</p>
            <p className="font-sans mt-1.5 text-sm text-muted-foreground leading-relaxed tracking-wide">Take a breath, TherapyxAI is getting ready for you</p>
          </div>
        </div>
      )}

      {!sessionActive && !sessionLoading && !closureData && (
        <div className="flex flex-col items-center gap-12 lg:gap-16">

          {/* ══════════════════ 1. TOP HERO SECTION ══════════════════ */}
          {/* For Guest mode (!user): 2-column layout with Hero text on left & Video card on right */}
          {/* For Logged-in users (user): Centered/Expanded hero layout without video card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 w-full items-center">

            {/* ── LEFT / MAIN HERO COLUMN: Greeting, Credits & Clean CTAs ── */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left gap-6 lg:gap-7 w-full">

              {/* Hero Greeting */}
              <section className="flex flex-col items-center lg:items-start gap-3 text-center lg:text-left animate-fade-up w-full max-w-2xl"
                       style={{ animationDelay: '0ms' }}>
                <p className="font-sans text-xl sm:text-2xl font-normal text-sky-700 dark:text-sky-400">
                  {greeting}, {firstName}.
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground tracking-tight text-center lg:text-left">
                  How are you feeling today?
                </h1>

                <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto lg:mx-0">
                  Select how you feel to start your session
                </p>
              </section>

              {/* 9 Emotion Cards (3 per row x 3 rows = 9 items) */}
              <section className="flex flex-col items-center lg:items-start gap-3.5 animate-fade-up w-full max-w-2xl"
                       style={{ animationDelay: '70ms' }}>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
                  {REASON_OPTIONS.map((opt) => {
                    const isSelected = selectedReason === opt.title;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          wakeBackend();
                          setSelectedReason(opt.title);
                          handleOpenSessionSetup(TAB.VOICE, opt.title);
                        }}
                        className={`flex items-center gap-2 sm:gap-2.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl border transition-all duration-200 group text-left ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                            : 'border-border/60 bg-card hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base sm:text-lg">
                          {opt.icon}
                        </div>
                        <h4 className={`font-sans text-xs font-medium leading-tight truncate ${
                          isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-foreground'
                        }`}>
                          {opt.title}
                        </h4>
                      </button>
                    );
                  })}
                </div>

                {/* Custom reason text input when "Something else on my mind" is selected */}
                {(selectedReason === 'Something else on my mind' || selectedReason === 'Other Reason') && (
                  <div className="w-full flex flex-col gap-2.5 animate-fade-in">
                    <textarea
                      rows={2}
                      placeholder="Specify what's on your mind today..."
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      className="w-full p-3.5 text-xs rounded-xl border border-border/60 bg-card text-foreground focus:ring-2 focus:ring-sky-500 font-medium shadow-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const effectiveReason = customReasonText.trim() || 'Other Reason';
                        wakeBackend();
                        handleOpenSessionSetup(TAB.VOICE, effectiveReason);
                      }}
                      className="self-end px-4 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <span>Continue</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Direct CTA Buttons for Instant Session Start */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const effectiveReason = (selectedReason === 'Other Reason' && customReasonText.trim()) ? customReasonText.trim() : selectedReason;
                      wakeBackend();
                      handleOpenSessionSetup(TAB.VOICE, effectiveReason);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all active:scale-95 w-full sm:w-auto"
                  >
                    <MicIcon color="#ffffff" />
                    <span>Start Speaking</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const effectiveReason = (selectedReason === 'Other Reason' && customReasonText.trim()) ? customReasonText.trim() : selectedReason;
                      wakeBackend();
                      handleOpenSessionSetup(TAB.CHAT, effectiveReason);
                    }}
                    className="group flex-1 flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card hover:bg-muted/50 px-5 py-3 text-sm font-medium text-foreground shadow-sm transition-all active:scale-95 w-full sm:w-auto"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground">
                      <ChatIcon active />
                    </span>
                    <span>Chat instead</span>
                  </button>
                </div>
              </section>

            </div>

            {/* ── RIGHT COLUMN: QUICK ACTIONS CARD ── */}
            <div className={`${user ? 'hidden lg:flex' : 'flex'} lg:col-span-5 justify-center lg:justify-end w-full`}>
              {user ? (
                /* Logged-in User Quick Actions Card */
                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm flex flex-col justify-between w-full self-center my-auto animate-fade-up">
                  <div className="space-y-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick actions</span>
                    <h3 className="text-xl font-bold text-foreground">
                      Care Hub
                    </h3>

                    {/* Quick Action Item Buttons */}
                    <div className="flex flex-col gap-2.5 pt-1">
                      {/* Option 1: Manage Appointments */}
                      <button
                        type="button"
                        onClick={() => {
                          if (profile?.role === 'therapist') {
                            onOpenTherapistDashboard?.();
                          } else if (onOpenAppointments) {
                            onOpenAppointments();
                          }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 text-sm">
                            📅
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 transition-colors">
                              {profile?.role === 'therapist' ? 'Open Dashboard' : 'Manage appointments'}
                            </h4>
                            <p className="text-[11px] text-muted-foreground">View your upcoming therapy sessions</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-sky-600">→</span>
                      </button>

                      {/* Option 2: Explore Therapists */}
                      {onOpenTherapistList && (
                        <button
                          type="button"
                          onClick={onOpenTherapistList}
                          className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all group text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-sm">
                              🩺
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 transition-colors">Find a therapist</h4>
                              <p className="text-[11px] text-muted-foreground">Connect with licensed psychologists</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-sky-600">→</span>
                        </button>
                      )}

                      {/* Option 3: Take Exercises */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenExercises) {
                            onOpenExercises();
                          } else {
                            const el = document.getElementById('exercises-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 text-sm">
                            🫁
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 transition-colors">Mindful exercises</h4>
                            <p className="text-[11px] text-muted-foreground">Box breathing & grounding techniques</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-sky-600">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Guest User Quick Options Card */
                <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm flex flex-col justify-between w-full self-center my-auto animate-fade-up">
                  <div className="space-y-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Explore TherapyxAI</span>
                    <h3 className="text-xl font-bold text-foreground">
                      Get started
                    </h3>

                    {/* Quick Option Action Buttons */}
                    <div className="flex flex-col gap-2.5 pt-1">
                      {/* Option 1: Explore Our Therapists */}
                      {onOpenTherapistList && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!user || !token) {
                              setAuthOpen(true);
                            } else {
                              onOpenTherapistList();
                            }
                          }}
                          className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all group text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 text-sm">
                              🩺
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 transition-colors">Find a therapist</h4>
                              <p className="text-[11px] text-muted-foreground">Browse verified counselors & psychologists</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-sky-600">→</span>
                        </button>
                      )}

                      {/* Option 2: Join as Therapist */}
                      <button
                        type="button"
                        onClick={() => {
                          if (token) {
                            if (profile?.role === 'therapist') {
                              onOpenTherapistDashboard?.();
                            } else {
                              onOpenTherapistOnboarding?.();
                            }
                          } else {
                            onOpenTherapistAuth?.();
                          }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-sm">
                            🤝
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 transition-colors">Join as therapist</h4>
                            <p className="text-[11px] text-muted-foreground">Connect with clients & manage sessions</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-sky-600">→</span>
                      </button>

                      {/* Option 3: Explore Exercises */}
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('exercises-section');
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 text-sm">
                            🫁
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-600 transition-colors">Mindful exercises</h4>
                            <p className="text-[11px] text-muted-foreground">Try free 1-tap Box Breathing</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-sky-600">↓</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ══════════════════ 2. THERAPIST CARDS (DISTINCT SECTION TRANSITION BELOW HERO) ══════════════════ */}
          <section id="therapist-section" className="w-full mt-10 sm:mt-14 pt-8 sm:pt-10 border-t border-border/60 animate-fade-up">

            {/* Professional Therapist Discovery Carousel */}
            <div className="w-full">
              <TherapistCarousel
                token={token}
                isGuest={!token || !user}
                guestName={guestName}
                userRole={profile?.role}
                onSignIn={() => setAuthOpen(true)}
                onOpenProfile={(therapist) => {
                  if (!token || !user) {
                    setAuthOpen(true);
                  } else {
                    onOpenTherapistProfile?.(therapist);
                  }
                }}
                onOpenBooking={(therapist) => {
                  if (!token || !user) {
                    setAuthOpen(true);
                  } else {
                    onOpenTherapistBooking?.(therapist);
                  }
                }}
                onOpenOnboarding={onOpenTherapistOnboarding}
                onOpenTherapistList={() => {
                  if (!token || !user) {
                    setAuthOpen(true);
                  } else {
                    onOpenTherapistList?.();
                  }
                }}
              />
            </div>

          </section>

          {/* ══════════════════ 3. BOX BREATHING & COMMUNITY GRID (POSITIONED DIRECTLY BELOW THERAPISTS) ══════════════════ */}
          <section id="exercises-section" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch animate-fade-up" style={{ animationDelay: '100ms' }}>

            {/* Left Card: Free Box Breathing for Guests, or Mindful Exercises Hub for Logged-In Users */}
            <div className="lg:col-span-6 flex flex-col h-full w-full">
              {!user ? (
                <QuickCalmCard onOpenAuth={() => setAuthOpen(true)} />
              ) : (
                <div className="glass-card rounded-3xl p-6 sm:p-7 border border-primary/20 bg-gradient-to-br from-primary/10 via-purple-500/10 to-emerald-500/10 shadow-sm flex flex-col justify-between h-full w-full">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/20">
                      <span>🫁</span>
                      <span>4 Mindful Exercises Unlocked</span>
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        Mindful Exercises & Self-Care
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                        Practice guided exercises to calm your mind, ground your senses, express feelings, or release physical tension.
                      </p>
                    </div>

                    {/* 4 Exercises Preview Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="p-3 rounded-2xl bg-card/80 border border-border/50 flex items-center gap-2.5">
                        <span className="text-xl">🫁</span>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Box Breathing</h4>
                          <p className="text-[10px] text-muted-foreground">11 rounds · 4-count rhythm</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-card/80 border border-border/50 flex items-center gap-2.5">
                        <span className="text-xl">🌿</span>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Grounding 5-4-3-2-1</h4>
                          <p className="text-[10px] text-muted-foreground">5 senses interactive guide</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-card/80 border border-border/50 flex items-center gap-2.5">
                        <span className="text-xl">🎨</span>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Express Drawing</h4>
                          <p className="text-[10px] text-muted-foreground">Mood check & drawing canvas</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-card/80 border border-border/50 flex items-center gap-2.5">
                        <span className="text-xl">🧘</span>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">PMR Muscle Release</h4>
                          <p className="text-[10px] text-muted-foreground">10s guided tension release</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenExercises) {
                          onOpenExercises();
                        }
                      }}
                      className="w-full py-3.5 px-5 rounded-2xl text-xs font-bold text-primary-foreground shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                      style={{ backgroundImage: 'var(--gradient-primary)' }}
                    >
                      <span>Take Mindful Exercises</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Empathy & Community Card with CTA */}
            <div className="lg:col-span-6 flex flex-col h-full w-full">
              <EmpathyCommunityCard onShareFeedback={() => setFeedbackModalOpen(true)} />
            </div>

          </section>

          {/* ══════════════════ 4. DIFFERENTIATORS & TESTIMONIALS (GUEST MODE ONLY - AT BOTTOM) ══════════════════ */}
          {!user && (
            <div className="w-full space-y-12 lg:space-y-16">
              {/* Differentiators Carousel */}
              <DifferentiatorsCarousel />

              {/* Client Voice Stories ("We Heard You") — Commented out for now */}
              {/* <ClientVoiceSection /> */}
            </div>
          )}



          {/* ══════════════════ 6. FOOTER ══════════════════ */}
          <footer className="w-full border-t pt-4 mt-1" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              {/* Brand */}
              <div className="flex items-center gap-2">
                <TherapixIcon size={22} variant="color" className="shrink-0" />
                <span className="font-extrabold text-xs text-foreground tracking-tight">Therapyx<span className="gradient-text">AI</span></span>
              </div>

              {/* Contact us */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Contact us:</span>
                <a href="mailto:gobeyondthelimits.ai@gmail.com" className="text-xs font-semibold text-foreground hover:text-primary transition-colors">
                  gobeyondthelimits.ai@gmail.com
                </a>
              </div>

              <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TherapyxAI</p>
            </div>
          </footer>

        </div>
      )}

      {/* ══════════════════ ACTIVE SESSION VIEW ══════════════════ */}
      {sessionActive && (
        <div className="animate-fade-up flex flex-col" style={{ height: 'calc(100dvh - 120px)', maxHeight: 'calc(100dvh - 120px)' }}>

          {/* ── Mode switcher + session info bar ── */}
          <div className="sticky top-3 z-40 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-3xl glass-card px-4 py-2.5 shadow-elevated backdrop-blur-xl">
            {/* Mode tabs */}
            <div className="flex items-center gap-1 rounded-2xl bg-secondary/60 p-1">
              <button
                onClick={() => setSessionMode('voice')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  sessionMode === 'voice'
                    ? 'bg-card text-primary shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MicIcon active={sessionMode === 'voice'} />
                Voice
              </button>
              <button
                onClick={() => setSessionMode('chat')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  sessionMode === 'chat'
                    ? 'bg-card text-primary shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ChatIcon active={sessionMode === 'chat'} />
                Chat
              </button>
            </div>

            {/* Timer + end */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-dot-pulse" />
                {formatTimer(sessionSecs)}
              </div>
              <button
                onClick={handleEndSession}
                disabled={sessionLoading}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/25 bg-card px-3.5 py-2 text-xs font-semibold text-destructive shadow-soft transition-all hover:border-destructive/50 hover:bg-destructive/10 disabled:opacity-70"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <line x1="18" y1="6"  x2="6"  y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="6"  y1="6"  x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                {sessionLoading ? 'Ending…' : 'End session'}
              </button>
            </div>
          </div>

          {/* ══ VOICE MODE ══ */}
          {sessionMode === 'voice' && (
            <>
              {/* Two-column content area — stacks vertically on mobile, side-by-side on md+ */}
              <div className="flex flex-col md:flex-row flex-1 gap-0 overflow-hidden rounded-3xl glass-card min-h-[360px] md:min-h-[480px]">

                {/* Top (mobile) / Left (desktop): Waveform panel */}
                <div className="relative flex flex-col h-[220px] md:h-auto md:w-[45%] md:shrink-0 border-b border-border/60 md:border-b-0 md:border-r md:border-border/60">
                  {/* Status bar */}
                  <div className="flex items-center gap-2 border-b border-border/40 px-5 py-3">
                    {voiceCtrl.isReconnecting ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#b87010' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M18.36 6.64A9 9 0 1 1 5.64 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Connection timeout
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${voiceCtrl.isListening || voiceCtrl.isStreaming ? 'bg-primary animate-dot-pulse' : 'bg-muted-foreground/40'}`} />
                        {voiceCtrl.stateLabel}
                      </span>
                    )}
                  </div>
                  {/* Waveform fills the rest */}
                  <div className="relative flex-1 flex flex-col overflow-hidden">
                    {/* Organic blob ambience — replaces radial gradient */}
                    <svg aria-hidden focusable="false"
                         className="pointer-events-none absolute inset-0 h-full w-full"
                         viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"
                         style={{ opacity: 0.55 }}>
                      <defs>
                        <radialGradient id="blobG1" cx="50%" cy="50%" r="50%">
                          <stop offset="0%"   stopColor="var(--cp)" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="var(--cp)" stopOpacity="0"    />
                        </radialGradient>
                        <radialGradient id="blobG2" cx="50%" cy="50%" r="50%">
                          <stop offset="0%"   stopColor="var(--cpg)" stopOpacity="0.16" />
                          <stop offset="100%" stopColor="var(--cpg)" stopOpacity="0"    />
                        </radialGradient>
                      </defs>
                      {/* Primary blob — large, left-of-centre */}
                      <path
                        d="M160,60 C220,30 310,55 330,130 C350,205 295,270 215,275 C135,280 60,235 45,160 C30,85 100,90 160,60 Z"
                        fill="url(#blobG1)"
                        style={{ transformOrigin: '195px 168px', animation: 'float 8s ease-in-out infinite' }}
                      />
                      {/* Secondary blob — smaller, right accent */}
                      <path
                        d="M290,80 C325,65 365,90 370,130 C375,170 345,205 305,210 C265,215 230,185 235,145 C240,105 255,95 290,80 Z"
                        fill="url(#blobG2)"
                        style={{ transformOrigin: '302px 145px', animation: 'float 10s ease-in-out infinite reverse', animationDelay: '1.5s' }}
                      />
                    </svg>
                    {/* Processing overlay — 3 pulsing dots */}
                    {voiceCtrl.isProcessing && !micDenied && (
                      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 animate-dot-pulse"
                                  style={{ animationDelay: `${i * 0.25}s` }} />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Thinking…</span>
                      </div>
                    )}

                    {/* Mic permission denied overlay */}
                    {micDenied && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 px-5 animate-fade-up"
                           style={{ background: 'rgba(254,253,251,0.96)', backdropFilter: 'blur(6px)' }}>
                        {/* Icon */}
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ color: '#ef4444' }}>
                            <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>

                        {/* Message */}
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">Microphone blocked</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Therapyxai needs mic access to hear you.
                          </p>
                        </div>

                        {/* Steps */}
                        <div className="w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground space-y-2">
                          {[
                            { n: '1', text: 'Click the 🔒 icon in your browser\'s address bar' },
                            { n: '2', text: 'Find "Microphone" and set it to Allow' },
                            { n: '3', text: 'Refresh the page and tap the mic again' },
                          ].map(({ n, text }) => (
                            <div key={n} className="flex items-start gap-2.5">
                              <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{n}</span>
                              <span className="leading-5">{text}</span>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col items-center gap-2 w-full">
                          <button
                            onClick={() => { setMicDenied(false); voiceMicRef.current?.micClick(); }}
                            className="w-full rounded-xl py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                            style={{ backgroundImage: 'var(--gradient-primary)' }}
                          >
                            Try again
                          </button>
                          <a href={window.location.href}
                             className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            Or refresh the page
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="relative z-10 flex-1" style={{ minHeight: 0 }}>
                      <VoiceMic
                        ref={voiceMicRef}
                        wsUrl={`${WS_BASE}/ws/voice`}
                        token={token}
                        sessionId={sessionId}
                        languageCode={languageCode}
                        guestId={!token ? (localStorage.getItem('guest_id') ?? '') : ''}
                        guestName={!token ? guestName : ''}
                        reason={selectedReason ?? ''}
                        silenceMs={1500}
                        silenceThreshold={0.022}
                        noiseGateMs={300}
                        vadWarmupMs={350}
                        autoRestartOnDone={true}
                        hideControls={true}
                        onControlState={setVoiceCtrl}
                        onTranscript={handleTranscript}
                        onToken={handleToken}
                        onDone={handleDone}
                        onError={handleVoiceError}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Live voice transcript */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border/40 px-5 py-3">
                    {/* Leaf presence icon */}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-primary opacity-70">
                      <path d="M17 8C8 10 5.9 16.17 3.82 19.07L5 19c.5 0 1.4-.2 2-.8 1-1 2.5-2.5 4-4 .9-.9 2.1-1.5 3.5-1.5s2.6.6 3.5 1.5c1 1 1 2.5 0 3.5S16 19 15 19H3"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="label-section text-muted-foreground">Conversation</span>
                  </div>
                  <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3">
                    {messages.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center">
                        <p className="text-body text-muted-foreground text-center" style={{ fontSize: '0.875rem' }}>
                          Your conversation will appear<br/>here once you start speaking.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg, i) => {
                        const isAI   = msg.role === 'ai';
                        const isUser = msg.role === 'user';
                        // Show a small role hint only when the speaker changes
                        const prevRole = i > 0 ? messages[i - 1].role : null;
                        const showHint = prevRole !== msg.role;

                        return (
                          <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>

                            {/* Speaker hint — only on first bubble in a run */}
                            {showHint && (
                              <div className={`flex items-center gap-1.5 mb-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                                {isAI && (
                                  /* Small leaf presence icon for AI */
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-primary opacity-60">
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
                              /* AI — serif, organic left-origin radius, borderless */
                              <div
                                className="max-w-[88%] text-foreground"
                                style={{
                                  fontFamily: 'Lora, Georgia, serif',
                                  fontSize: 15,
                                  lineHeight: 1.85,
                                  letterSpacing: '-0.01em',
                                  padding: '14px 18px',
                                  borderRadius: '4px 20px 20px 20px',
                                  background: 'rgb(var(--c-primary) / 0.07)',
                                }}
                              >
                                {msg.text}
                              </div>
                            ) : (
                              /* User — sans-serif, organic right-origin radius, surface bg */
                              <div
                                className="max-w-[82%] text-foreground"
                                style={{
                                  fontFamily: 'Inter, ui-sans-serif, sans-serif',
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  padding: '11px 15px',
                                  borderRadius: '20px 4px 20px 20px',
                                  background: 'rgb(var(--c-secondary))',
                                }}
                              >
                                {msg.text}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Breathing presence orb — replaces the 3-dot "Responding…" */}
                    {voiceCtrl.isStreaming && (
                      <div className="flex items-start pl-1">
                        {/* Outer breathe ring */}
                        <div
                          className="animate-breathe flex items-center justify-center rounded-full"
                          style={{
                            width: 38, height: 38,
                            background: 'rgb(var(--c-primary) / 0.1)',
                          }}
                        >
                          {/* Inner pulse core */}
                          <div
                            className="animate-breathe rounded-full"
                            style={{
                              width: 14, height: 14,
                              background: 'rgb(var(--c-primary) / 0.45)',
                              animationDelay: '0.4s',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div ref={transcriptEndRef} />
                  </div>
                </div>
              </div>

              {/* Voice bottom control bar */}
              <div className="mt-3 md:mt-4 flex items-center justify-center gap-4 rounded-3xl glass-card px-4 py-3 md:px-6 md:py-4">
                <button
                  onClick={() => voiceMicRef.current?.micClick()}
                  disabled={voiceCtrl.isProcessing || !voiceCtrl.authed}
                  aria-label="Toggle microphone"
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-none shadow-elevated transition-all hover:scale-105 active:scale-95 disabled:opacity-60 ${voiceCtrl.isListening ? 'vm-pulse-glow' : ''}`}
                  style={{
                    backgroundImage: voiceCtrl.isPaused || !voiceCtrl.authed
                      ? 'linear-gradient(135deg, #d1cfc9, #e8e4de)'
                      : 'var(--gradient-primary)',
                  }}
                >
                  {voiceCtrl.isPaused
                    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--c-muted-foreground, #7a7871)' }}>
                        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                        <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                      </svg>
                    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#fefefe' }}>
                        <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor"/>
                        <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                        <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                        <line x1="8"  y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                      </svg>
                  }
                </button>
                {voiceCtrl.hasStarted && (
                  <button
                    onClick={() => voiceCtrl.isPaused ? voiceMicRef.current?.resume() : voiceMicRef.current?.pause()}
                    disabled={voiceCtrl.isProcessing}
                    aria-label={voiceCtrl.isPaused ? 'Resume' : 'Pause'}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card shadow-soft transition-all hover:shadow-elevated disabled:opacity-40"
                  >
                    {voiceCtrl.isPaused
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="var(--cp)"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="5"  y="3" width="4" height="18" rx="1.5" fill="var(--cp)"/>
                          <rect x="15" y="3" width="4" height="18" rx="1.5" fill="var(--cp)"/>
                        </svg>
                    }
                  </button>
                )}
              </div>
            </>
          )}

          {/* ══ CHAT MODE ══ */}
          {sessionMode === 'chat' && (
            <div className="flex flex-1 flex-col overflow-hidden rounded-3xl glass-card min-h-0">
              <div className="flex items-center gap-2 border-b border-border/40 px-5 py-3">
                <ChatIcon active />
                <span className="font-sans text-xs font-semibold text-foreground tracking-wide">Chat with Therapyxai</span>
                <span className="label-section ml-auto text-muted-foreground">Type below</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden p-4">
                <ChatBox
                  wsUrl={`${WS_BASE}/ws/chat`}
                  token={token}
                  sessionId={sessionId}
                  languageCode={languageCode}
                  guestId={!token ? (localStorage.getItem('guest_id') ?? '') : ''}
                  guestName={!token ? guestName : ''}
                  reason={selectedReason ?? ''}
                />
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Not a substitute for professional care.
          </p>
        </div>
      )}

      {/* Session setup modal — language → format (2-step) */}
      <SessionSetupModal
        open={setupOpen}
        preferTab={setupTab}
        onStart={(lang, mood, tab) => handleStartSession(lang, mood, tab)}
        onClose={() => setSetupOpen(false)}
      />

      <AIConsentModal
        open={showConsentModal}
        onAgree={handleConsentAgree}
        onCancel={() => { setShowConsentModal(false); setPendingStartConfig(null); }}
        isGuest={!user}
      />

      {/* Guest name modal — shown to unauthenticated users who haven't entered a name yet */}
      {showGuestModal && (
        <GuestNameModal
          onStart={handleGuestStart}
          onSignIn={() => { setShowGuestModal(false); setAuthOpen(true); }}
        />
      )}

      {/* Auth modal */}
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            setGuestTimeUp(false);
            if (onAuthClose) onAuthClose();
          }}
          onSuccess={handleSuccess}
          showUnauthMessage={guestTimeUp}
          guestTimeUp={guestTimeUp}
          onOpenTherapistAuth={() => {
            setAuthOpen(false);
            setGuestTimeUp(false);
            onOpenTherapistAuth?.();
          }}
        />
      )}

      {profileOnboardingOpen && (
        <OptionalProfileOnboarding
          open={profileOnboardingOpen}
          initialProfile={editableProfile}
          loading={profileSaving || profileLoading}
          onSkip={handleSkipProfileOnboarding}
          onComplete={handleCompleteProfileOnboarding}
        />
      )}

      {editProfileOpen && (
        <EditProfileModal
          open={editProfileOpen}
          initialProfile={editableProfile}
          loading={profileSaving}
          onClose={() => setEditProfileOpen(false)}
          onSave={handleSaveProfile}
        />
      )}

      {feedbackModalOpen && (
        <PlatformFeedbackModal
          isOpen={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          userId={user?.id}
          guestName={guestName}
        />
      )}
    </main>
  );
}
