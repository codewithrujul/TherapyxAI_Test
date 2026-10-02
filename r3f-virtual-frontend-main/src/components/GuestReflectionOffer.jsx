import { useState } from 'react';

// Wording is about "reflections" for self-reflection. Do NOT change it to claim diagnosis or
// detection of conditions. If the consent sentence changes, bump CONSENT_VERSION in utils/guestReflections.js.

/**
 * Offered to a guest after their session and mood check. Signing in is the only way to get
 * reflections, and it needs an explicit tick first.
 *
 * Props: expiresInMin (number|null), onSignIn(), onDecline()
 */
export default function GuestReflectionOffer({ expiresInMin, onSignIn, onDecline }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/30 px-4 pb-6 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-reflection-title"
        className="glass-card w-full max-w-sm rounded-3xl px-5 py-6 animate-fade-up"
      >
        <div className="flex items-start gap-3.5">
          <div className="relative flex shrink-0 items-center justify-center" style={{ width: 44, height: 44 }}>
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" />
            <span className="relative text-xl">🌿</span>
          </div>
          <div className="min-w-0 flex-1">
            <p id="guest-reflection-title" className="text-sm font-semibold text-foreground">
              Want reflections on this session?
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Sign in or create a free account and we&rsquo;ll prepare gentle notes on the themes
              from today&rsquo;s conversation, saved in your Session History.
            </p>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>
            I agree you may save and analyse this conversation to prepare my reflections.
          </span>
        </label>

        {expiresInMin ? (
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground/80">
            Please do this within about {expiresInMin} minute{expiresInMin === 1 ? '' : 's'}; after that
            this conversation is discarded and can&rsquo;t be used.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={!agreed}
            onClick={onSignIn}
            className="w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            Sign in / Create account
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="w-full rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            No thanks
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-4 text-muted-foreground/80">
          Automated notes for self-reflection. Not a diagnosis or medical advice.
        </p>
      </div>
    </div>
  );
}
