import { useEffect, useState } from 'react';

// Timing (ms). Bar fills over PROGRESS_MS, then the "done" state is held briefly before closing.
const PROGRESS_MS  = 3200;
const DONE_HOLD_MS = 1300;

// Wording is deliberately about "reflections" and "themes" for self-reflection.
// Do NOT change it to claim diagnosis, detection of conditions, or prediction of illness.
const STEPS = [
  'Gathering the themes from today…',
  'Noticing what stood out…',
  'Preparing your reflections…',
];

/**
 * Shown briefly on the main screen after a signed-in user finishes a session and the mood check.
 * The animation is a reassurance while the real analysis runs in the background; it does not
 * track that work. Tap the card's ✕ to dismiss early.
 *
 * Props: onClose(), onOpenHistory()
 */
export default function SessionReflectionNotice({ onClose, onOpenHistory }) {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [filled, setFilled] = useState(false);  // flips once, so the CSS transition runs 0% -> 100%
  const [step,   setStep]   = useState(0);
  const [done,   setDone]   = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    const timers = [
      setTimeout(() => setStep(1), PROGRESS_MS / 3),
      setTimeout(() => setStep(2), (PROGRESS_MS * 2) / 3),
      setTimeout(() => setDone(true), PROGRESS_MS),
      setTimeout(() => onClose?.(), PROGRESS_MS + DONE_HOLD_MS),
    ];
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[9999] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="glass-card pointer-events-auto relative w-full max-w-sm rounded-3xl px-5 py-5 animate-fade-up"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
        >
          ✕
        </button>

        <div className="flex items-start gap-3.5">
          {/* Soft pulse ring, matching the mood-check screen */}
          <div className="relative flex shrink-0 items-center justify-center" style={{ width: 44, height: 44 }}>
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" />
            <span className="relative text-xl">{done ? '✓' : '🌿'}</span>
          </div>

          <div className="min-w-0 flex-1 pr-5">
            <p className="text-sm font-semibold text-foreground">
              {done ? 'All set' : 'Reflecting on your session'}
            </p>
            {/* key={step} re-triggers the fade so each phrase eases in */}
            <p key={done ? 'done' : step} className="mt-0.5 text-xs leading-5 text-muted-foreground animate-fade-up">
              {done ? 'Nicely done for today.' : STEPS[step]}
            </p>
          </div>
        </div>

        {/* Horizontal progress bar */}
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={done ? 100 : undefined}
          aria-label="Preparing your reflections"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: filled ? '100%' : '0%',
              backgroundImage: 'var(--gradient-primary)',
              transition: reduceMotion ? 'none' : `width ${PROGRESS_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        </div>

        <p className="mt-3 text-xs leading-5 text-foreground">
          Your reflections will appear in{' '}
          <button
            type="button"
            onClick={onOpenHistory}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Session History
          </button>{' '}
          in a few minutes.
        </p>
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground/80">
          Automated notes for self-reflection. Not a diagnosis or medical advice.
        </p>
      </div>
    </div>
  );
}
