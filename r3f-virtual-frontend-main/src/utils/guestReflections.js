import { API_BASE } from '../config';

// Bump when the consent wording in GuestReflectionOffer changes; the Backend stores it with the consent.
export const CONSENT_VERSION = '2026-09-v1';

const CONSENT_KEY = 'guest_reflection_consent';   // set when the guest ticks the box, before sign-in
const NOTICE_KEY  = 'reflection_notice_pending';  // set after sign-in if reflections were claimed
const CONSENT_MAX_AGE_MS = 30 * 60 * 1000;        // consent only counts for the sign-in that follows

const read  = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const drop  = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

export function recordGuestConsent() {
  write(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, at: Date.now() }));
}

export function clearGuestConsent() { drop(CONSENT_KEY); }

function currentConsent() {
  try {
    const c = JSON.parse(read(CONSENT_KEY) || 'null');
    if (c && c.v && Date.now() - c.at < CONSENT_MAX_AGE_MS) return c.v;
  } catch { /* ignore */ }
  return null;
}

/** True once, if a sign-in just claimed guest reflections. Clears the flag. */
export function takeReflectionNoticeFlag() {
  const on = read(NOTICE_KEY) === '1';
  if (on) drop(NOTICE_KEY);
  return on;
}

export async function fetchGuestReflectionOffer(guestId) {
  try {
    const res = await fetch(`${API_BASE}/guest/reflection-offer?guest_id=${encodeURIComponent(guestId)}`);
    if (!res.ok) return { available: false };
    return await res.json();
  } catch {
    return { available: false };
  }
}

export async function declineGuestReflections(guestId) {
  clearGuestConsent();
  try {
    await fetch(`${API_BASE}/guest/reflection-decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_id: guestId }),
    });
  } catch { /* non-critical */ }
}

/**
 * Links the browser's guest sessions to the account that just signed in. If the guest ticked
 * the reflections consent shortly before, it is sent along so the Backend can prepare reflections.
 */
export async function linkGuestSessions(accessToken) {
  const guestId = localStorage.getItem('guest_id');
  if (!guestId || !accessToken) return;
  const consentVersion = currentConsent();
  try {
    const res = await fetch(`${API_BASE}/auth/link-guest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({
        guest_id: guestId,
        ...(consentVersion ? { consent: true, consent_version: consentVersion } : {}),
      }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.reflections?.claimed > 0) write(NOTICE_KEY, '1');
    }
    localStorage.removeItem('guest_id');
    localStorage.removeItem('guest_name');
  } catch { /* non-critical */ }
  clearGuestConsent();
}
