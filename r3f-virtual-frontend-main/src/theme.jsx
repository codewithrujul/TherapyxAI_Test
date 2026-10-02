import { createContext, useContext, useState } from 'react';

// ── Palettes ──────────────────────────────────────────────────────────────────

export const DARK = {
  pageBg:          '#060b10',
  headerBg:        '#080d13',
  headerBorder:    '#0f1c2a',
  cardBg:          '#0a0f14',
  cardBorder:      '#0f1c2a',
  cardBorderHover: '#1e3a5a',
  userMsgBg:       '#0d1520',
  userMsgBorder:   '#1a2a3a',
  aiMsgBg:         '#080f18',
  aiMsgBorder:     '#0f1c2a',
  tabBg:           '#0a0f14',
  tabBorder:       '#0f1c2a',
  tabActiveBg:     '#0d1f30',
  inputBg:         '#080d13',
  inputBorder:     '#1e3048',
  text:            '#c8dff5',
  textBright:      '#e8f4ff',
  textSecondary:   '#8ab4d4',
  textMuted:       '#4a7a9a',
  textSubtle:      '#3a5a7a',
  textFaint:       '#1e3048',
  accent:          '#378ADD',
  accentHover:     '#2a6ab0',
  btnPrimary:      '#378ADD',
  btnPrimaryText:  '#ffffff',
  danger:          '#c84a4a',
  sectionLabel:    '#3a5a7a',
  tagBg:           '#0a0f14',
  tagBorder:       '#1e3048',
  tagText:         '#4a7a9a',
  divider:         '#0f1c2a',
  scrollThumb:     '#1e3048',
  accentGlow:      'rgba(55,138,221,0.18)',
  accentAlpha:     'rgba(55,138,221,0.08)',
  btnGradientEnd:  '#1a6abf',
  avatarGradient:  'linear-gradient(135deg, #1a6abf 0%, #0e3d7a 100%)',
  cardShadow:      '0 1px 3px rgba(0,0,0,0.4)',

  mood: {
    happy:      { bg: '#0a2a1a', border: '#1D9E75', text: '#1D9E75' },
    joyful:     { bg: '#0a2a1a', border: '#1D9E75', text: '#1D9E75' },
    excited:    { bg: '#0a2a1a', border: '#1D9E75', text: '#1D9E75' },
    calm:       { bg: '#0a1f30', border: '#378ADD', text: '#378ADD' },
    neutral:    { bg: '#0a1422', border: '#3a5a7a', text: '#4a7a9a' },
    sad:        { bg: '#0f1a2e', border: '#3a5a9a', text: '#6a8abf' },
    anxious:    { bg: '#2a1a08', border: '#c47820', text: '#d4892a' },
    stressed:   { bg: '#2a1a08', border: '#c47820', text: '#d4892a' },
    worried:    { bg: '#2a1a08', border: '#c47820', text: '#d4892a' },
    angry:      { bg: '#2a0a0a', border: '#9a3030', text: '#c84a4a' },
    frustrated: { bg: '#2a0a0a', border: '#9a3030', text: '#c84a4a' },
    _default:   { bg: '#0a1422', border: '#3a5a7a', text: '#4a7a9a' },
  },
};

export const LIGHT = {
  pageBg:          '#FAFBFC',
  headerBg:        '#ffffff',
  headerBorder:    '#e2e8f0',
  cardBg:          '#ffffff',
  cardBorder:      '#e2e8f0',
  cardBorderHover: '#93c5fd',
  userMsgBg:       '#eff6ff',
  userMsgBorder:   '#bfdbfe',
  aiMsgBg:         '#f8fafc',
  aiMsgBorder:     '#e2eaf4',
  tabBg:           '#F8FAFC',
  tabBorder:       '#e2e8f0',
  tabActiveBg:     '#eff6ff',
  inputBg:         '#f8fafc',
  inputBorder:     '#e2e8f0',
  text:            '#1e293b',
  textBright:      '#0f172a',
  textSecondary:   '#334155',
  textMuted:       '#475569',
  textSubtle:      '#64748b',
  textFaint:       '#cbd5e1',
  accent:          '#2563eb',
  accentHover:     '#1d4ed8',
  btnPrimary:      '#2563eb',
  btnPrimaryText:  '#ffffff',
  danger:          '#dc2626',
  sectionLabel:    '#64748b',
  tagBg:           '#f1f5f9',
  tagBorder:       '#e2e8f0',
  tagText:         '#475569',
  divider:         '#e2eaf4',
  scrollThumb:     '#cbd5e1',
  accentGlow:      'rgba(37,99,235,0.14)',
  accentAlpha:     'rgba(37,99,235,0.06)',
  btnGradientEnd:  '#1d4ed8',
  avatarGradient:  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  cardShadow:      '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -18px rgba(15,23,42,0.16)',

  mood: {
    happy:      { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
    joyful:     { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
    excited:    { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
    calm:       { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
    neutral:    { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
    sad:        { bg: '#eff6ff', border: '#93c5fd', text: '#3b82f6' },
    anxious:    { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' },
    stressed:   { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' },
    worried:    { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c' },
    angry:      { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
    frustrated: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
    _default:   { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
  },
};

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext({
  t: LIGHT,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('mw-theme');
    return saved ? saved === 'dark' : false;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('mw-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ t: isDark ? DARK : LIGHT, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// ── Toggle button (shared across pages) ──────────────────────────────────────

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${isDark ? '#1e3048' : '#dde8f5'}`,
        borderRadius: 8,
        cursor: 'pointer',
        color: isDark ? '#4a7a9a' : '#64748b',
        transition: 'color .2s, border-color .2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color       = isDark ? '#378ADD' : '#2563eb';
        e.currentTarget.style.borderColor = isDark ? '#2a4a6a' : '#93c5fd';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color       = isDark ? '#4a7a9a' : '#64748b';
        e.currentTarget.style.borderColor = isDark ? '#1e3048' : '#dde8f5';
      }}
    >
      {isDark
        ? /* Sun */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="1"  x2="12" y2="4"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="1"  y1="12" x2="4"  y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="20" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        : /* Moon */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
      }
    </button>
  );
}
