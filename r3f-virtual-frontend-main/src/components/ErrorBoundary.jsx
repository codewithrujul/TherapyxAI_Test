import { Component } from 'react';
import TherapixIcon from './TherapixIcon';

/**
 * ErrorBoundary — catches unhandled render errors in any child component.
 *
 * Without this, a single component crash (WS error, 3D fail, etc.) would
 * white-screen / black-screen the entire app with no recovery path.
 *
 * Wrap the root <App /> in main.jsx so every page is protected.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log to console so it's visible in Railway / Vercel logs
    console.error('[ErrorBoundary] Caught error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center"
          style={{ background: 'var(--gradient-atmosphere)', backgroundAttachment: 'fixed' }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-elevated"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            <TherapixIcon size={28} variant="white" />
          </div>

          <div className="flex flex-col gap-2 max-w-sm">
            <p
              style={{
                fontFamily:    "'DM Sans', ui-sans-serif, sans-serif",
                fontSize:      'clamp(1.4rem, 3vw, 2rem)',
                fontWeight:    700,
                letterSpacing: '-0.02em',
                lineHeight:    1.15,
                color:         'rgb(var(--c-foreground))',
              }}
            >
              Something went wrong.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            Refresh page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
