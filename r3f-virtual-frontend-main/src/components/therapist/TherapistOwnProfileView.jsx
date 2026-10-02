import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config';
import { formatINR } from '../../lib/currency';

// Read-only view of the details a therapist submitted during onboarding.
// Data comes from GET /therapists/me/profile (the `therapists` row, which is
// populated from the onboarding form when an admin approves the request).
// Editing is intentionally not supported yet.

const SESSION_TYPE_LABELS = { video: 'Video', audio: 'Audio', chat: 'Chat' };

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// All prices in the product are in Indian Rupees, whatever currency code is stored on the row.
function formatRate(rate) {
  if (isBlank(rate) || Number.isNaN(Number(rate))) return null;
  return formatINR(rate);
}

function formatExperience(years) {
  if (isBlank(years) || Number.isNaN(Number(years))) return null;
  const n = Number(years);
  return `${n} ${n === 1 ? 'year' : 'years'}`;
}

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Chips({ items, emptyText }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="px-3.5 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailTile({ label, children }) {
  return (
    <div className="p-5 rounded-3xl border border-border/60 bg-card min-w-0">
      <span className="block text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <div className="text-sm font-bold text-foreground mt-1 break-words">{children}</div>
    </div>
  );
}

const Dash = () => <span className="text-muted-foreground font-medium">—</span>;

// Presentational part — takes the therapist row and renders it. No data fetching here.
export function TherapistProfileDetails({ therapist }) {
  const [imgFailed, setImgFailed] = useState(false);

  const location = [therapist.address_city, therapist.address_country].filter((p) => !isBlank(p)).join(', ');
  const rate = formatRate(therapist.hourly_rate);
  const experience = formatExperience(therapist.years_of_experience);
  const sessionTypes = Array.isArray(therapist.supported_session_types)
    ? therapist.supported_session_types.map((t) => SESSION_TYPE_LABELS[t] || t)
    : [];
  const showPhoto = !isBlank(therapist.profile_picture_url) && !imgFailed;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {showPhoto ? (
          <img
            src={therapist.profile_picture_url}
            alt={therapist.full_name || 'Profile photo'}
            onError={() => setImgFailed(true)}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-primary/20 shadow-md shrink-0"
          />
        ) : (
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl flex items-center justify-center text-3xl font-extrabold text-primary-foreground shadow-md ring-4 ring-primary/20 shrink-0"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
            aria-hidden="true"
          >
            {getInitials(therapist.full_name)}
          </div>
        )}

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {therapist.is_verified ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ✓ Verified
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Verification pending
              </span>
            )}
          </div>

          <h2 className="text-2xl font-extrabold text-foreground tracking-tight break-words">
            {therapist.full_name || '—'}
          </h2>
          {!isBlank(therapist.title) && (
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{therapist.title}</p>
          )}
          {!isBlank(therapist.short_headline) && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
              {therapist.short_headline}
            </p>
          )}
        </div>
      </div>

      {/* About */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About</h3>
        {isBlank(therapist.bio) ? (
          <p className="text-sm text-muted-foreground italic">No bio provided.</p>
        ) : (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line break-words">{therapist.bio}</p>
        )}
      </div>

      {/* Specialties + Languages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Specialties</h3>
          <Chips items={therapist.specialties} emptyText="No specialties provided." />
        </div>
        <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Languages</h3>
          <Chips items={therapist.languages} emptyText="No languages provided." />
        </div>
      </div>

      {/* Contact & practice details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailTile label="Email">{isBlank(therapist.email) ? <Dash /> : therapist.email}</DetailTile>
        <DetailTile label="Phone">{isBlank(therapist.phone) ? <Dash /> : therapist.phone}</DetailTile>
        <DetailTile label="Location">{location || <Dash />}</DetailTile>
        <DetailTile label="Experience">{experience || <Dash />}</DetailTile>
        <DetailTile label="Session rate">{rate || <Dash />}</DetailTile>
        <DetailTile label="Session types">
          {sessionTypes.length === 0 ? (
            <Dash />
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {sessionTypes.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-semibold border border-border/60"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </DetailTile>
      </div>
    </div>
  );
}

export default function TherapistOwnProfileView({ token, onSessionExpired, onClose }) {
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, expired }

  const fetchProfile = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/therapists/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json?.error?.message || 'Failed to load your profile.');
        err.expired = res.status === 401;
        throw err;
      }
      setTherapist(json.therapist ?? null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[TherapistOwnProfileView] fetch failed:', err);
      setError({ message: err.message || 'Could not load your profile.', expired: !!err.expired });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProfile(controller.signal);
    return () => controller.abort();
  }, [fetchProfile]);

  return (
    <div className="space-y-6 animate-fade-in">
      {onClose && (
        <div className="flex items-center p-4 rounded-3xl border border-border/70 bg-card shadow-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-extrabold rounded-2xl border border-border/70 bg-background hover:bg-muted text-foreground transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            <span>← Back to Practitioner Dashboard</span>
          </button>
        </div>
      )}

      <div>
        <h2 className="text-xl font-extrabold text-foreground">My Profile</h2>
        <p className="text-xs text-muted-foreground mt-1">The details you provided during onboarding.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-3xl border bg-card/60 animate-pulse h-24" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-3">
          <span>⚠️ {error.message}</span>
          <button
            type="button"
            onClick={() => (error.expired && onSessionExpired ? onSessionExpired() : fetchProfile())}
            className="px-3 py-1.5 rounded-xl border border-rose-500/30 font-bold hover:bg-rose-500/10 transition-all whitespace-nowrap"
          >
            {error.expired && onSessionExpired ? 'Log In Again' : 'Retry'}
          </button>
        </div>
      ) : !therapist ? (
        <div className="rounded-3xl border border-border/60 bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No profile details were found for your account.</p>
        </div>
      ) : (
        <TherapistProfileDetails therapist={therapist} />
      )}
    </div>
  );
}
