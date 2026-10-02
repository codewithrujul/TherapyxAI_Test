import { useState, useEffect, createContext, useContext } from 'react';

const STORAGE_KEY = 'therapixai-palette';

export const PALETTES = {
  'light':      { id: 'light',      label: 'Light', dot: '#2563eb', attr: 'light'      },
  'warm-dusk':  { id: 'warm-dusk',  label: 'Dusk',  dot: '#f59e0b', attr: 'warm-dusk'  },
  'bloom':      { id: 'bloom',      label: 'Night', dot: '#818cf8', attr: 'bloom'      },
};

const PaletteContext = createContext({ palette: 'light', setPalette: () => {} });

// ─── Provider — wraps App, applies data-theme on <html> ───────────────────────
export function PaletteProvider({ children }) {
  const [palette, setPaletteState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && PALETTES[saved] ? saved : 'light';
  });

  // Apply data-theme attribute to <html> whenever palette changes
  useEffect(() => {
    const attr = PALETTES[palette]?.attr;
    if (attr) {
      document.documentElement.setAttribute('data-theme', attr);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(STORAGE_KEY, palette);
  }, [palette]);

  // Apply on first mount (handles page refresh with saved preference)
  useEffect(() => {
    const attr = PALETTES[palette]?.attr;
    if (attr) document.documentElement.setAttribute('data-theme', attr);
    else       document.documentElement.removeAttribute('data-theme');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setPalette(id) {
    if (PALETTES[id]) setPaletteState(id);
  }

  return (
    <PaletteContext.Provider value={{ palette, setPalette }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  return useContext(PaletteContext);
}

// ─── Icon-only light/dark toggle — for tight spaces (mobile header) ───────────
// Collapses the full palette set down to two states: 'light' vs. anything else
// (treated as "dark", mapped to the 'bloom' night palette).
export function ThemeIconToggle({ className = '' }) {
  const { palette, setPalette } = usePalette();
  const isDark = palette !== 'light';

  return (
    <button
      type="button"
      onClick={() => setPalette(isDark ? 'light' : 'bloom')}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 glass-card text-muted-foreground transition-all duration-250 hover:text-foreground ${className}`}
    >
      {isDark ? (
        /* Moon icon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        /* Sun icon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

// ─── Toggle button — drop into any header ────────────────────────────────────
export function PaletteToggle() {
  const { palette, setPalette } = usePalette();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/60 glass-card p-1">
      {Object.values(PALETTES).map(({ id, label, dot }) => {
        const active = palette === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setPalette(id)}
            title={`${label} theme`}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-250 ${
              active
                ? 'bg-secondary/80 text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            {/* Colour swatch dot — scales + glows when active */}
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 transition-all duration-250"
              style={{
                background: dot,
                transform:  active ? 'scale(1.25)' : 'scale(1)',
                boxShadow:  active ? `0 0 0 2px rgba(255,255,255,0.7), 0 0 6px ${dot}60` : 'none',
              }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
