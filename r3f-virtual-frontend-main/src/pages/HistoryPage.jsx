import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import InsightsCard from '../components/InsightsCard';
import { useSessionInsights } from '../hooks/useSessionInsights';
import { API_BASE } from '../config';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// Some sessions never got a real AI-written summary and fall back to the raw
// "User: ... AI: ..." transcript dump instead. Showing that as a "summary" is both
// unreadable (no line breaks) and a duplicate of the Conversation section below —
// so we detect it and skip the card rather than render a wall of raw text.
function looksLikeRawTranscript(text) {
  if (!text) return false;
  return /^\s*user:/i.test(text) && /\bai:/i.test(text);
}

const MOOD_SCORE_MAP = {
  1: { emoji: '😔', label: 'Struggling', color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)'  },
  2: { emoji: '😟', label: 'Low',        color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)' },
  3: { emoji: '😌', label: 'Okay',       color: '#ca8a04', bg: 'rgba(202,138,4,0.10)',  border: 'rgba(202,138,4,0.25)'  },
  4: { emoji: '🙂', label: 'Good',       color: '#0d9488', bg: 'rgba(13,148,136,0.10)', border: 'rgba(13,148,136,0.25)' },
  5: { emoji: '🌞', label: 'Great',      color: '#16a34a', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.25)'  },
};

// Section card tints — all derived from the one brand blue, just different depth/opacity,
// so colored cards read as "on brand" instead of a rainbow of unrelated accent hues.
export const SECTION_TINTS = {
  primary: { bg: 'rgb(var(--c-primary) / 0.055)', iconBg: 'rgb(var(--c-primary) / 0.16)',       icon: 'rgb(var(--c-primary))' },
  deep:    { bg: 'rgb(var(--c-accent) / 0.06)',    iconBg: 'rgb(var(--c-accent) / 0.16)',        icon: 'rgb(var(--c-accent))'  },
  glow:    { bg: 'rgb(var(--c-primary-glow) / 0.14)', iconBg: 'rgb(var(--c-primary-glow) / 0.35)', icon: 'rgb(var(--c-accent))' },
};

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
      <line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
// Distinct from the per-category icons (Target/List/ChatDot) below so the
// "From This Session" card header doesn't repeat the "Interests" row's icon.
function MemoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
export function ChatDotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function HistoryPage({ token, onBack, onOpenTherapistList }) {
  const [view,       setView]       = useState('list');
  const [sessions,   setSessions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [detail,     setDetail]     = useState(null);
  const [detLoading, setDetLoading] = useState(false);
  const [error,      setError]      = useState(null);
  const [detailId,   setDetailId]   = useState(null);

  // Soft "themes" for the open session (signed-in users; renders nothing unless enabled server-side)
  const insights = useSessionInsights(token, view === 'detail' ? detailId : null);

  // ── Fetch session list ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(({ sessions: s }) => { setSessions(s ?? []); setLoading(false); })
      .catch(err => { setError(`Failed to load sessions (${err.message})`); setLoading(false); });
  }, [token]);

  // ── Open detail ───────────────────────────────────────────────────────────
  const openDetail = useCallback(async (id) => {
    setDetLoading(true);
    setDetailId(id);
    setView('detail');
    try {
      const r = await fetch(`${API_BASE}/sessions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetLoading(false);
    }
  }, [token]);

  const backToList = () => { setView('list'); setDetail(null); setDetailId(null); };

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>

      {/* ── Header — shared across every internal page: back button + theme + profile ── */}
      <PageHeader
        onBack={view === 'detail' ? backToList : onBack}
        backLabel={view === 'detail' ? 'Sessions' : 'Back'}
      />

      {/* ── Content ── */}
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-8 sm:px-8">
        {view === 'list' ? (
          <div className="mb-1 flex items-center justify-between gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Session History</h1>
            {sessions.length > 0 && (
              <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundImage: 'var(--gradient-primary)' }}>
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        ) : (
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Session Detail</p>
            <p className="text-xs text-muted-foreground">
              {detail?.session ? `${formatDate(detail.session.start_time)} · ${formatTime(detail.session.start_time)}` : ''}
            </p>
          </div>
        )}

        {view === 'list' && (
          <ListView sessions={sessions} loading={loading} error={error} onOpen={openDetail} />
        )}
        {view === 'detail' && (
          <DetailView detail={detail} loading={detLoading} insights={insights} onOpenTherapistList={onOpenTherapistList} />
        )}
      </main>
    </div>
  );
}

// ── List view — sessions grouped by calendar day, each group under its own date label ──
function ListView({ sessions, loading, error, onOpen }) {
  if (loading) return <CenterMsg text="Loading sessions…" />;
  if (error)   return <CenterMsg text={error} variant="error" />;
  if (!sessions.length) return (
    <CenterMsg text="No completed sessions yet. Start your first session!" />
  );

  // Group consecutive-in-list sessions by their formatted date, preserving API order.
  const groups = [];
  for (const s of sessions) {
    const label = formatDate(s.start_time);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(s);
    } else {
      groups.push({ label, items: [s] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(group => (
        <div key={group.label} className="flex flex-col gap-3">
          <p className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
          <div className="flex flex-col gap-3">
            {group.items.map(s => <SessionCard key={s.id} session={s} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionCard({ session, onOpen }) {
  const dur     = formatDuration(session.duration_secs);
  const checkin = session.mood_checkin ? MOOD_SCORE_MAP[session.mood_checkin] : null;
  const preview = session.summary
    ? session.summary.slice(0, 120) + (session.summary.length > 120 ? '…' : '')
    : null;

  // The icon badge picks up the session's own mood color when one exists, instead of
  // always being the same flat blue — a small, free way to make the list scannable
  // without introducing new colors (reuses MOOD_SCORE_MAP, already used for the chip).
  const badgeColor = checkin?.color ?? 'rgb(var(--c-primary))';
  const badgeBg    = checkin?.bg    ?? 'rgb(var(--c-primary) / 0.12)';

  return (
    <button
      type="button"
      onClick={() => onOpen(session.id)}
      className="group glass-card flex w-full items-start gap-3 rounded-3xl border border-border/40 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elevated"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: badgeBg, color: badgeColor }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-semibold text-foreground">{formatTime(session.start_time)}</span>
          <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
            {dur && (
              <span className="rounded-full bg-secondary/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{dur}</span>
            )}
            {checkin && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ background: checkin.bg, border: `1px solid ${checkin.border}`, color: checkin.color }}>
                {checkin.emoji} {checkin.label}
              </span>
            )}
          </div>
        </div>
        {preview
          ? <p className="text-sm leading-6 text-muted-foreground">{preview}</p>
          : <p className="text-sm italic text-muted-foreground/60">No summary available</p>
        }
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────
function DetailView({ detail, loading, insights, onOpenTherapistList }) {
  if (loading)                      return <CenterMsg text="Loading session…" />;
  if (!detail || !detail.session)   return <CenterMsg text="Session not found" variant="error" />;

  const { session, summary, memories, messages } = detail;
  const dur          = formatDuration(session.duration_secs);
  const checkin      = session.mood_checkin ? MOOD_SCORE_MAP[session.mood_checkin] : null;
  const hasRealSummary = summary && !looksLikeRawTranscript(summary);

  return (
    <div className="flex flex-col gap-4">

      {/* Meta bar — compact gradient hero card */}
      <div className="relative overflow-hidden rounded-2xl px-4 py-3.5 text-white" style={{ backgroundImage: 'var(--gradient-primary)', boxShadow: 'var(--shadow-btn, 0 8px 30px rgba(56,189,248,0.25))' }}>
        <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <CalendarIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight tracking-tight truncate">{formatDate(session.start_time)}</p>
            <p className="text-[11px] text-white/80">{formatTime(session.start_time)}{dur ? ` · ${dur}` : ''}</p>
          </div>
          {checkin && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold" style={{ color: checkin.color }}>
              {checkin.emoji} {checkin.label}
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      {hasRealSummary && (
        <Section title="Session Summary" icon={<DocIcon />} tint="primary">
          <p className="text-sm leading-7 text-muted-foreground">{summary}</p>
        </Section>
      )}

      {/* AI Analysis — themes + "you don't have to carry this alone" merged into one card */}
      <InsightsCard insights={insights} onOpenTherapistList={onOpenTherapistList} />

      {/* Memories */}
      {memories && (memories.interests?.length || memories.facts?.length || memories.other?.length) ? (
        <Section title="From This Session" icon={<MemoryIcon />} tint="glow">
          <div className="flex flex-col gap-3">
            {memories.interests?.length > 0 && (
              <MemRow icon={<TargetIcon />} label="Interests" items={memories.interests} />
            )}
            {memories.facts?.length > 0 && (
              <MemRow icon={<ListIcon />} label="Facts" items={memories.facts} />
            )}
            {memories.other?.length > 0 && (
              <MemRow icon={<ChatDotIcon />} label="Other" items={memories.other} />
            )}
          </div>
        </Section>
      ) : null}

      {/* Transcript — bounded to a mobile-window-sized box so the reader scrolls
          within the conversation, not the whole page */}
      {messages?.length > 0 && (
        <Section title={`Conversation · ${messages.length} exchange${messages.length !== 1 ? 's' : ''}`} icon={<ChatDotIcon />} tint="deep">
          <div className="flex flex-col gap-4 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex gap-3 items-start">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[28px] pt-2.5">
                    You
                  </span>
                  <p className="flex-1 rounded-2xl rounded-tl-sm border border-border/60 bg-secondary/50 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                    {m.user_msg}
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary min-w-[28px] pt-2.5">
                    AI
                  </span>
                  <p className="flex-1 rounded-2xl rounded-tl-sm border border-primary/20 px-3.5 py-2.5 text-sm leading-relaxed text-foreground"
                     style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), transparent)' }}>
                    {m.ai_reply}
                  </p>
                </div>
                {i < messages.length - 1 && (
                  <div className="my-1 border-t border-border/40" />
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {!summary && !messages?.length && (
        <CenterMsg text="This session has no recorded data yet." />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
export function Section({ title, icon, tint = 'primary', children }) {
  const t = SECTION_TINTS[tint] ?? SECTION_TINTS.primary;
  return (
    <div
      className="rounded-3xl border border-border/40 p-5 backdrop-blur-md"
      style={{ background: t.bg, boxShadow: 'var(--shadow-card)' }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: t.iconBg, color: t.icon }}>
            {icon}
          </span>
        )}
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.icon }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function MemRow({ icon, label, items }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary" style={{ background: 'rgb(var(--c-primary) / 0.12)' }}>{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs leading-none text-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CenterMsg({ text, variant }) {
  return (
    <div className={`py-16 text-center text-sm ${
      variant === 'error' ? 'text-destructive' : 'text-muted-foreground'
    }`}>
      {text}
    </div>
  );
}
