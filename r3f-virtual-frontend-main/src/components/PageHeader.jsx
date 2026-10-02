import { useMemo } from 'react';
import { PaletteToggle, ThemeIconToggle } from '../palette';
import TherapixIcon from './TherapixIcon';
import UserMenu from './UserMenu';

/**
 * Shared header for every internal page (Therapist Portal, Discovery, Appointments, etc.)
 * Matches the home page header branding:
 *  - Left: TherapyxAI Product Logo (TherapixIcon + brand text) + optional Back button + optional page badge
 *  - Right: Context actions + Theme Toggle (PaletteToggle on desktop, ThemeIconToggle on mobile) + User profile/menu
 */
export default function PageHeader({
  onBack,
  backLabel = 'Back',
  showBack = true,
  onHome,
  badge,
  actions,
  user: propUser,
  token: propToken,
  onProfileClick,
  onSignOut,
  onOpenTherapistDashboard,
  onOpenAdminDashboard,
  onOpenTherapistOnboarding,
  onOpenMyProfile,
}) {
  const currentUser = useMemo(() => {
    if (propUser) return propUser;
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [propUser]);

  const currentToken = useMemo(() => {
    if (propToken) return propToken;
    try {
      return localStorage.getItem('accessToken') || '';
    } catch {
      return '';
    }
  }, [propToken]);

  const handleHomeClick = () => {
    if (onHome) {
      onHome();
    } else if (onBack) {
      onBack();
    } else {
      window.location.href = '/';
    }
  };

  const handleDefaultSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md px-4 sm:px-8 py-3.5 transition-all duration-300">
      {/* ── Left: Brand Product Logo & Navigation ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div
          onClick={handleHomeClick}
          role="button"
          tabIndex={0}
          title="TherapyxAI Home"
          className="flex items-center gap-2 cursor-pointer select-none transition-transform active:scale-95 group shrink-0"
        >
          <TherapixIcon size={32} variant="color" className="shrink-0 transition-transform group-hover:scale-105" />
          <span className="font-extrabold text-base md:text-lg text-foreground tracking-tight">
            Therapyx<span className="gradient-text">AI</span>
          </span>
        </div>

        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 ml-1 sm:ml-2 shadow-xs shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">Back</span>
          </button>
        )}

        {badge && (
          <div className="hidden md:flex items-center ml-1">
            {badge}
          </div>
        )}
      </div>

      {/* ── Right: Custom Actions, Theme Palette, and User Profile ── */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}

        {/* Desktop theme palette */}
        <div className="hidden sm:flex items-center">
          <PaletteToggle />
        </div>

        {/* Mobile theme toggle */}
        <ThemeIconToggle className="sm:hidden" />

        {/* User Menu or Account Avatar */}
        {currentUser && currentToken ? (
          <UserMenu
            user={currentUser}
            token={currentToken}
            onSignOut={handleDefaultSignOut}
            onOpenTherapistDashboard={onOpenTherapistDashboard}
            onOpenAdminDashboard={onOpenAdminDashboard}
            onOpenTherapistOnboarding={onOpenTherapistOnboarding}
            onOpenMyProfile={onOpenMyProfile}
            isInTherapistPortal={typeof window !== 'undefined' && window.location.pathname.includes('/therapist')}
          />
        ) : (
          <button
            type="button"
            onClick={onProfileClick ?? onBack}
            aria-label="Account"
            title="Account"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 glass-card text-primary transition-all duration-250 hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
