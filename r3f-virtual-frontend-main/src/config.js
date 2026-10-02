// Central URL config — all API and WebSocket URLs come from here.
// In production (Vercel), set VITE_API_BASE and VITE_WS_BASE in the project environment variables.
// In local dev, the defaults below are used automatically.

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';
export const WS_BASE  = import.meta.env.VITE_WS_BASE  ?? 'ws://localhost:8000';

// Shown to a user when a session's insights include a gentle "support" note.
// !! VERIFY every entry below (number still active, right country, staffed hours) before
// !! turning INSIGHTS_ENABLED on in the Backend. Wrong numbers here can do real harm.
export const SUPPORT_RESOURCES = [
  { name: 'Tele-MANAS (India, free mental health helpline)', phone: '14416' },
  { name: 'Emergency services (India)',                       phone: '112'   },
];
