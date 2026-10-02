/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display:    ['Roboto', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        sans:       ['Roboto', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        therapist:  ['Roboto', 'sans-serif'],
      },
      colors: {
        // All values reference CSS custom properties so both themes work at runtime.
        // The <alpha-value> placeholder lets Tailwind opacity modifiers work (bg-primary/50).
        background:              'rgb(var(--c-background)          / <alpha-value>)',
        foreground:              'rgb(var(--c-foreground)          / <alpha-value>)',
        card:                    'rgb(var(--c-card)                / <alpha-value>)',
        'card-foreground':       'rgb(var(--c-card-foreground)     / <alpha-value>)',
        primary:                 'rgb(var(--c-primary)             / <alpha-value>)',
        'primary-foreground':    'rgb(var(--c-primary-foreground)  / <alpha-value>)',
        'primary-glow':          'rgb(var(--c-primary-glow)        / <alpha-value>)',
        secondary:               'rgb(var(--c-secondary)           / <alpha-value>)',
        'secondary-foreground':  'rgb(var(--c-secondary-foreground)/ <alpha-value>)',
        muted:                   'rgb(var(--c-muted)               / <alpha-value>)',
        'muted-foreground':      'rgb(var(--c-muted-foreground)    / <alpha-value>)',
        accent:                  'rgb(var(--c-accent)              / <alpha-value>)',
        'accent-foreground':     'rgb(var(--c-accent-foreground)   / <alpha-value>)',
        destructive:             'rgb(var(--c-destructive)         / <alpha-value>)',
        'destructive-foreground':'rgb(var(--c-destructive-fg)      / <alpha-value>)',
        border:                  'rgb(var(--c-border)              / <alpha-value>)',
        input:                   'rgb(var(--c-input)               / <alpha-value>)',
        ring:                    'rgb(var(--c-ring)                / <alpha-value>)',
        sos:                     'rgb(var(--c-sos)                 / <alpha-value>)',
        'sos-foreground':        'rgb(var(--c-sos-foreground)      / <alpha-value>)',
      },
      boxShadow: {
        soft:     '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -18px rgba(15,23,42,0.16)',
        elevated: '0 1px 3px rgba(15,23,42,0.06), 0 14px 34px -24px rgba(15,23,42,0.24)',
        glow:     '0 16px 42px -24px rgba(var(--c-primary) / 0.38)',
      },
      animation: {
        'fade-up':    'fade-up 0.6s ease-out both',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        'breathe':    'breathe 4s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'dot-pulse':  'dot-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(var(--c-primary)/0.35), 0 20px 50px -20px rgba(var(--c-primary)/0.45)' },
          '50%':       { boxShadow: '0 0 0 18px rgba(var(--c-primary)/0),  0 24px 60px -18px rgba(var(--c-primary)/0.55)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)',    opacity: '0.7' },
          '50%':       { transform: 'scale(1.08)', opacity: '1'   },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)'  },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'dot-pulse': {
          '0%, 100%': { opacity: '1'   },
          '50%':       { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};
