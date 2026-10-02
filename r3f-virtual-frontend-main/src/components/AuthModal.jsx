import { useState, useRef } from 'react';
import TherapixIcon from './TherapixIcon';
import { API_BASE } from '../config';
import { linkGuestSessions } from '../utils/guestReflections';
import { supabase } from '../lib/supabaseClient';

function saveSession(data) {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
}

export function isTokenExpired() {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return true;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ─── Reusable field ───────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, suffix }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all ${
            suffix ? 'pr-14' : ''
          } ${
            focused
              ? 'border-primary/60 bg-background ring-2 ring-primary/20'
              : 'border-border/70 bg-background/60 hover:border-border'
          }`}
          style={{ boxSizing: 'border-box' }}
        />
        {suffix && (
          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AuthModal({ onClose, onSuccess, showUnauthMessage = false, guestTimeUp = false, onOpenTherapistAuth }) {
  const [tab,      setTab]      = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const overlayRef = useRef(null);

  function handleOverlayClick(e) {
    if (!showUnauthMessage && e.target === overlayRef.current) onClose();
  }

  function switchTab(next) {
    setTab(next);
    setError('');
    setSuccess('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Please fill in all fields.');
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json?.error?.message || json?.message || 'Login failed';
        throw new Error(message);
      }
      saveSession(json.data);
      await linkGuestSessions(json.data.accessToken);
      setSuccess(`Welcome back, ${json.data.user.name}!`);
      setTimeout(() => { onSuccess?.(json.data.user, { isNewUser: false }); onClose(); }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!email || !password || !name) return setError('Please fill in all fields.');
    setLoading(true);
    try {
      const regRes  = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const regJson = await regRes.json();
      if (!regRes.ok) {
        const message = regJson?.error?.message || regJson?.message || 'Registration failed';
        throw new Error(message);
      }

      // Step 2 — auto-login with the same credentials
      setSuccess('Account created! Signing you in…');
      const loginRes  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginJson = await loginRes.json();
      if (!loginRes.ok) {
        // Registration worked but auto-login failed — fall back gracefully
        const message = loginJson?.error?.message || loginJson?.message;
        setSuccess('Account created! Please sign in.');
        if (message) setError(message);
        setTimeout(() => { switchTab('login'); setPassword(''); }, 1200);
        return;
      }

      // Step 3 — save session and close modal, same as normal login
      saveSession(loginJson.data);
      await linkGuestSessions(loginJson.data.accessToken);
      setSuccess(`Welcome, ${loginJson.data.user.name}!`);
      setTimeout(() => { onSuccess?.(loginJson.data.user, { isNewUser: true }); onClose(); }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);

    // Custom backend OAuth — Google consent shows our own domain.
    // To switch to production: update GOOGLE_REDIRECT_URI + FRONTEND_URL in backend .env
    // and add the production callback URL in Google Console Authorised redirect URIs.
    window.location.href = `${API_BASE}/auth/google`;
  }

  const showHideBtn = (
    <button
      type="button"
      onClick={() => setShowPass(p => !p)}
      className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
    >
      {showPass ? 'Hide' : 'Show'}
    </button>
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[10001] flex items-center justify-center px-4 animate-fade-up"
      style={{
        background: 'rgba(248,250,252,0.78)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-border/60 bg-card/95 p-5 sm:p-6 shadow-elevated mx-3"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button — only when not required */}
        {!showUnauthMessage && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6"  x2="6"  y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6"  y1="6"  x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        {/* Brand */}
        <div className="flex flex-col items-center gap-2 pb-5 pt-1">
          <div className="flex items-center gap-2.5">
            <TherapixIcon size={40} variant="color" className="shrink-0" />
            <span className="font-extrabold text-xl tracking-tight text-foreground">Therapyx<span className="gradient-text">AI</span></span>
          </div>
          <p className="text-xs text-muted-foreground">Your private space to feel heard</p>
        </div>

        {/* Guest time-up notice */}
        {guestTimeUp && (
          <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-3 text-center">
            <p className="text-sm font-semibold text-primary">Your free 10 minutes are up</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sign up to keep your session history &amp; continue unlimited
            </p>
          </div>
        )}

        {/* Unauth notice */}
        {showUnauthMessage && !guestTimeUp && (
          <div className="mb-4 rounded-2xl bg-accent/60 px-3 py-2 text-center">
            <p className="text-xs font-semibold text-accent-foreground">Sign in to continue</p>
            <p className="mt-0.5 text-[11px] text-accent-foreground/80">
              Your sessions are saved to your account
            </p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1">
          {[['login', 'Sign In'], ['register', 'Register']].map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={`rounded-xl py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-card text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form
          onSubmit={tab === 'login' ? handleLogin : handleRegister}
          className="flex flex-col gap-3"
        >
          {tab === 'register' ? (
            <>
              <Field
                label="Full Name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Field
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                suffix={showHideBtn}
              />
              <p className="text-xs text-muted-foreground/80 mb-1">Password must be at least 6 characters.</p>
            </>
          ) : (
            <>
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Field
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                suffix={showHideBtn}
              />
            </>
          )}

          {/* Error / Success */}
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              {success}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="shimmer-btn relative overflow-hidden mt-1 h-11 w-full rounded-xl text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-70"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            {loading
              ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
              : tab === 'login'
              ? 'Sign In'
              : 'Create account'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="h-11 w-full rounded-xl border border-border/70 bg-background/60 text-sm font-medium text-foreground transition-all hover:bg-secondary/60 hover:border-border disabled:opacity-60 flex items-center justify-center gap-2.5"
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </form>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {tab === 'login'
            ? <>No account?{' '}<button type="button" onClick={() => switchTab('register')} className="text-primary hover:underline font-medium">Register here</button></>
            : <>Already have one?{' '}<button type="button" onClick={() => switchTab('login')} className="text-primary hover:underline font-medium">Sign in</button></>
          }
        </p>

        {onOpenTherapistAuth && (
          <div className="mt-3 pt-3 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTherapistAuth();
              }}
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 transition-colors"
            >
              Are you a therapist? Therapist Portal Sign In &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Default export — Sign In button (used in header) ─────────────────────────
export default function AuthButton({ onSuccess, onOpenTherapistAuth }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
      >
        Sign In
      </button>
      {open && (
        <AuthModal
          onClose={() => setOpen(false)}
          onSuccess={(user, meta) => { onSuccess?.(user, meta); setOpen(false); }}
          onOpenTherapistAuth={onOpenTherapistAuth}
        />
      )}
    </>
  );
}
