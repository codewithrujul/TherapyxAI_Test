import { useState } from 'react';
import TherapixIcon from './TherapixIcon';
import { trackCustomEvent } from '../lib/pixel';

export default function GuestNameModal({ onStart, onSignIn }) {
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Please enter at least 2 characters.'); return; }
    setLoading(true);
    trackCustomEvent('SubmitAnonymousName', {
      nameLength: trimmed.length
    });
    onStart(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(10,10,15,0.80)', backdropFilter: 'blur(8px)' }}

    >
      <div className="glass-card relative w-full max-w-sm rounded-3xl border border-border/40 p-6 shadow-elevated animate-fade-up">

        {/* Brand */}
        <div className="flex flex-col items-center gap-2 pb-5 pt-1">
          <div className="flex items-center gap-2.5">
            <TherapixIcon size={40} variant="color" className="shrink-0" />
            <span className="font-extrabold text-xl tracking-tight text-foreground">
              Therapyx<span className="gradient-text">AI</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center">No Sign In Required</p>
        </div>


        {/* Name form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <center>Just Enter Anonymous Name</center>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="Your name"
              autoFocus
              className="w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="shimmer-btn relative overflow-hidden mt-1 h-11 w-full rounded-xl text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-70"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            {loading ? 'Starting…' : 'Start'}
          </button>

        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          Your session is private · End-to-end encrypted
        </p>
      </div>
    </div>
  );
}
