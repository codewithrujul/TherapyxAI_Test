import { SUPPORT_RESOURCES } from '../config';

// Plain-language strength words. The Backend only ever sends these bands, never numbers.
const LEVEL_WORD = { light: 'a little', moderate: 'some', strong: 'a lot' };

function SparkleIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5l1.8 5.7 5.7 1.8-5.7 1.8-1.8 5.7-1.8-5.7-5.7-1.8 5.7-1.8L12 2.5z" fill="currentColor"/>
      <path d="M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" fill="currentColor" opacity="0.8"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * "AI Analysis" card for one session (signed-in users only) — merges the session's
 * detected themes and, when warranted, the "you don't have to carry this alone"
 * support note into one card so they read as one piece of AI-prepared analysis
 * rather than two separate, disconnected cards.
 * Renders nothing unless the Backend says there is something to show.
 * insights: { status: 'hidden'|'pending'|'ready'|'unavailable', themes: [...], showSupport }
 */
export default function InsightsCard({ insights, onOpenTherapistList }) {
  // Local development only (`npm run dev`): explain WHY nothing is showing. import.meta.env.DEV
  // is false in production builds, so real users never see these notes.
  const DEV = Boolean(import.meta.env?.DEV);

  if (!insights) return DEV ? <DevNote text="Insights: loading…" /> : null;
  const { status, themes = [], showSupport } = insights;

  if (DEV && status === 'hidden') {
    return <DevNote text="Insights: hidden. Either the Backend has INSIGHTS_ENABLED off, or this session has no analysis job (ANALYSIS_ENABLED was off when it ended)." />;
  }
  if (DEV && status === 'unavailable') {
    return <DevNote text="Insights: unavailable. Analysis failed for this session; run `npx ts-node scripts/checkAnalysis.ts` in Backend for the error." />;
  }
  if (DEV && status === 'error') {
    return <DevNote text="Insights: the request failed. Is the Backend running the new code (restart it), and is this session yours?" />;
  }

  if (status === 'pending') {
    return (
      <AnalysisCard>
        <p className="text-sm leading-6 text-white/75">
          Your reflections for this session are being prepared. Check back in a moment.
        </p>
      </AnalysisCard>
    );
  }

  if (status !== 'ready') return null;   // hidden / unavailable: show nothing, no error

  return (
    <AnalysisCard>
      {themes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {themes.map(t => (
            <span
              key={t.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs text-white"
            >
              <span className="font-medium">{t.label}</span>
              <span className="text-white/60">· {LEVEL_WORD[t.level] ?? ''}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-white/75">
          Nothing in particular stood out in this session.
        </p>
      )}

      {/* You don't have to carry this alone — shown as a continuation of the same analysis,
          only when the backend flags this session as warranting it. */}
      {showSupport && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/12 pt-4">
          <div className="flex items-center gap-2">
            <ShieldIcon />
            <p className="text-xs font-bold uppercase tracking-wider text-white">You don't have to carry this alone</p>
          </div>
          <p className="text-sm leading-6 text-white/75">
            Some of what came up in this session sounded heavy. Talking with someone you trust, or
            with a trained listener, can help. If you ever feel in danger, please reach out right away.
          </p>
          <ul className="flex flex-col gap-2">
            {SUPPORT_RESOURCES.map(r => (
              <li key={r.phone} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm text-white">
                <span className="min-w-0 flex-1 leading-snug">{r.name}</span>
                <a href={`tel:${r.phone}`}
                   className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold"
                   style={{ color: 'rgb(var(--c-accent))' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {r.phone}
                </a>
              </li>
            ))}
          </ul>

          {onOpenTherapistList && (
            <button
              type="button"
              onClick={onOpenTherapistList}
              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ color: 'rgb(var(--c-accent))' }}
            >
              <span>Reach out to our therapist for this</span>
              <ArrowRightIcon />
            </button>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-white/50">
        These are automated observations and can be wrong. They are not a diagnosis or medical advice.
        Your conversation is encrypted while it's analysed.
      </p>
    </AnalysisCard>
  );
}

function DevNote({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
      <span className="font-semibold">Dev note (only visible locally):</span> {text}
    </div>
  );
}

// Dark, elevated treatment — deliberately distinct from the rest of the page's light
// cards so "prepared by AI" reads as its own special surface, the same way the date
// hero card stands out, just in a darker register instead of the bright brand gradient.
function AnalysisCard({ children }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5" style={{ backgroundImage: 'linear-gradient(150deg, #0b2036 0%, #123a5e 55%, #0f6bb2 120%)', boxShadow: '0 1px 1px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.35), 0 20px 40px -16px rgba(11,32,54,0.55)' }}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
      <div className="relative mb-4 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          <SparkleIcon />
          AI Analysis
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
