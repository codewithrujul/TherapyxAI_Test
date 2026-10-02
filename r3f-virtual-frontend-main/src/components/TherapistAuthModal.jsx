import { useState, useRef } from 'react';
import TherapixIcon from './TherapixIcon';
import { API_BASE } from '../config';

function saveSession(data) {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
}

export default function TherapistAuthModal({ onClose, onSuccess, onOpenUserAuth }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const overlayRef = useRef(null);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
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
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || 'Login failed');
      }

      saveSession(json.data);
      setSuccess(`Welcome back, ${json.data.user.name}!`);

      setTimeout(() => {
        onSuccess?.(json.data.user, json.data.accessToken);
        onClose();
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!email || !password || !name) return setError('Please fill in all required fields.');
    setLoading(true);

    try {
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, isTherapist: true, requestedRole: 'therapist' }),
      });
      const regJson = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regJson?.error?.message || regJson?.message || 'Registration failed');
      }

      // Auto login after registration
      setSuccess('Account created! Signing you into Therapist Portal…');
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginJson = await loginRes.json();

      if (!loginRes.ok) {
        setSuccess('Account created! Please sign in.');
        setTimeout(() => switchTab('login'), 1200);
        return;
      }

      saveSession(loginJson.data);
      setSuccess(`Welcome, ${loginJson.data.user.name}!`);

      setTimeout(() => {
        onSuccess?.(loginJson.data.user, loginJson.data.accessToken);
        onClose();
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
        className="relative w-full max-w-sm rounded-3xl border border-purple-500/30 bg-card/95 p-6 shadow-2xl mx-3 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Brand & Badge */}
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <div className="flex items-center gap-2">
            <TherapixIcon size={36} variant="color" />
            <span className="font-extrabold text-xl tracking-tight text-foreground">
              Therapyx<span className="gradient-text">AI</span>
            </span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25">
            👨‍⚕️ Practitioner Portal
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to manage your practice schedule, client appointments, and video consultations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => switchTab('login')}
            className={`rounded-xl py-2 transition-all ${
              tab === 'login'
                ? 'bg-card text-foreground shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchTab('register')}
            className={`rounded-xl py-2 transition-all ${
              tab === 'register'
                ? 'bg-card text-foreground shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Practitioner
          </button>
        </div>

        {/* Form */}
        <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-3 text-xs">
          {tab === 'register' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dr. Jane Doe"
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="therapist@example.com"
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="text-[11px] font-semibold text-purple-600 dark:text-purple-400"
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
            />
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-xs font-extrabold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            style={{ backgroundImage: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
          >
            {loading ? 'Authenticating...' : tab === 'login' ? 'Sign In to Practitioner Portal' : 'Register & Start Onboarding'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground pt-1">
          {tab === 'login' ? (
            <>New practitioner? <button onClick={() => switchTab('register')} className="text-purple-600 font-bold hover:underline">Apply here</button></>
          ) : (
            <>Already registered? <button onClick={() => switchTab('login')} className="text-purple-600 font-bold hover:underline">Sign in</button></>
          )}
        </p>

        {onOpenUserAuth && (
          <div className="pt-2 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUserAuth();
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <span>Looking for personal wellness?</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold underline">User Sign In →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
