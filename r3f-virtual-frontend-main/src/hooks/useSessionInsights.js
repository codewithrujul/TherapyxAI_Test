import { useState, useEffect } from 'react';
import { API_BASE } from '../config';

const POLL_MS   = 10_000;   // while insights are still being prepared
const MAX_POLLS = 30;       // ~5 minutes, then stop quietly

/**
 * Loads the soft "insights" for one session (signed-in users only).
 * Fetches once when a session is opened, and polls ONLY while the Backend says
 * "pending". Any error just means "show nothing" -- never an error message.
 *
 * Returns null while loading / hidden, otherwise { status, themes, showSupport }.
 */
export function useSessionInsights(token, sessionId) {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    setInsights(null);
    if (!token || !sessionId) return undefined;

    let cancelled = false;
    let timer = null;
    let polls = 0;

    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/sessions/${sessionId}/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (cancelled) return;
        setInsights(data);
        if (data.status === 'pending' && polls < MAX_POLLS) {
          polls += 1;
          timer = setTimeout(load, POLL_MS);
        }
      } catch {
        // Fail quiet for users. The 'error' status renders nothing in production; it only
        // lets the local-dev note below explain what happened.
        if (!cancelled) setInsights({ status: 'error', themes: [], showSupport: false });
      }
    };

    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [token, sessionId]);

  return insights;
}
