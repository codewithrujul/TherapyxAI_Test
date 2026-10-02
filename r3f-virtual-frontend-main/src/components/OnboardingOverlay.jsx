import { useState, useEffect } from 'react';
import TherapixIcon from './TherapixIcon';

const STORAGE_KEY = 'therapixai_onboarded';

// ─── Slide definitions ────────────────────────────────────────────────────────
const SLIDES = [
  {
    icon: (
      // Gentle waves — "a calm space"
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.3)" strokeWidth="1.5"/>
        {/* Sound / calm waves */}
        <path d="M16 32c4-6 8-6 12 0s8 6 12 0" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <path d="M10 32c6-10 13-10 19 0s13 10 19 0" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
        <path d="M22 32c2-3 4-3 6 0s4 3 6 0" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    heading: 'A calm space, just for you',
    body: 'TherapyxAI listens without judgment. Speak about what\'s on your mind, there\'s no right or wrong thing to say.',
  },
  {
    icon: (
      // Mic + speech bubble — "how it works"
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.3)" strokeWidth="1.5"/>
        {/* Mic body */}
        <rect x="27" y="14" width="10" height="18" rx="5" fill="#2563eb"/>
        {/* Mic arc */}
        <path d="M21 30a11 11 0 0 0 22 0" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        {/* Mic stand */}
        <line x1="32" y1="41" x2="32" y2="46" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="26" y1="46" x2="38" y2="46" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"/>
        {/* Small speech bubble top-right */}
        <rect x="38" y="14" width="14" height="10" rx="3" fill="#60a5fa" opacity="0.8"/>
        <path d="M41 24 L43 27 L46 24" fill="#60a5fa" opacity="0.8"/>
        {/* dots in bubble */}
        <circle cx="42" cy="19" r="1.2" fill="white"/>
        <circle cx="45" cy="19" r="1.2" fill="white"/>
        <circle cx="48" cy="19" r="1.2" fill="white"/>
      </svg>
    ),
    heading: 'Speak, and TherapyxAI responds',
    body: 'Tap the mic, speak naturally in English, Hindi, or Marathi. TherapyxAI replies with care, like a friend who truly listens.',
  },
  {
    icon: (
      // Shield + lock — "private & safe"
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" fill="rgba(37,99,235,0.12)" stroke="rgba(37,99,235,0.3)" strokeWidth="1.5"/>
        {/* Shield */}
        <path d="M32 14 L46 20 L46 34 C46 42 32 50 32 50 C32 50 18 42 18 34 L18 20 Z"
              fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round"/>
        {/* Lock body */}
        <rect x="26" y="32" width="12" height="9" rx="2" fill="#2563eb"/>
        {/* Lock shackle */}
        <path d="M28 32 L28 28 a4 4 0 0 1 8 0 L36 32" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" fill="none"/>
        {/* Keyhole dot */}
        <circle cx="32" cy="36.5" r="1.5" fill="white"/>
      </svg>
    ),
    heading: 'Private and safe',
    body: 'Your conversations are end-to-end encrypted and private to you. End a session anytime, no questions asked.',
  },
];

// ─── Dot indicator ─────────────────────────────────────────────────────────────
function Dots({ total, current }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width:  i === current ? 20 : 6,
            height: 6,
            background: i === current ? '#2563eb' : 'rgba(37,99,235,0.25)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
export default function OnboardingOverlay({ onDone }) {
  const [slide,   setSlide]   = useState(0);
  const [exiting, setExiting] = useState(false); // used for the final fade-out

  const isLast = slide === SLIDES.length - 1;

  function advance() {
    if (isLast) finish();
    else setSlide(s => s + 1);
  }

  function finish() {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, '1');
      onDone();
    }, 350);
  }

  const { icon, heading, body } = SLIDES[slide];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
      style={{
        backgroundImage: 'linear-gradient(160deg, rgb(254 253 251), rgb(245 242 235))',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 350ms ease',
      }}
    >
      {/* Brand mark */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-soft"
             style={{ backgroundImage: 'var(--gradient-primary)' }}>
          <TherapixIcon size={18} variant="white" />
        </div>
        <span className="font-display text-base font-semibold tracking-tight text-foreground">TherapyxAI</span>
      </div>

      {/* Skip — top-right, hidden on last slide */}
      {!isLast && (
        <button
          onClick={finish}
          className="absolute top-8 right-6 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      )}

      {/* Slide content */}
      <div
        key={slide}
        className="flex flex-col items-center text-center gap-6 animate-fade-up max-w-xs w-full"
      >
        {/* Illustration */}
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl"
             style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}>
          {icon}
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {heading}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>

        {/* Progress dots */}
        <Dots total={SLIDES.length} current={slide} />

        {/* CTA button */}
        <button
          onClick={advance}
          className="mt-1 h-11 w-full rounded-2xl text-sm font-semibold text-white shadow-elevated transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundImage: 'var(--gradient-primary)' }}
        >
          {isLast ? 'Get started →' : 'Next'}
        </button>
      </div>

      {/* Slide counter — subtle bottom hint */}
      <p className="absolute bottom-8 text-[11px] text-muted-foreground/60">
        {slide + 1} of {SLIDES.length}
      </p>
    </div>
  );
}

// ─── Guard — only render overlay for first-time visitors ──────────────────────
// NOTE: Onboarding disabled for now — re-enable by removing the early return below.
export function useOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // TODO: re-enable when onboarding content is finalised
    // if (!localStorage.getItem(STORAGE_KEY)) {
    //   setShow(true);
    // }
  }, []);

  return [show, () => setShow(false)];
}
