import { useState, useEffect, useCallback } from 'react';
import WellnessPage from './pages/WellnessPage';
import HistoryPage from './pages/HistoryPage';
import ExercisesPage from './pages/ExercisesPage';
import TherapistProfilePage from './pages/TherapistProfilePage';
import TherapistBookingPage from './pages/TherapistBookingPage';
import TherapistOnboardingPage from './pages/TherapistOnboardingPage';
import MyAppointmentsPage from './pages/MyAppointmentsPage';
import TherapistDashboardPage from './pages/TherapistDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TherapistListPage from './pages/TherapistListPage';
import TherapistAuthModal from './components/TherapistAuthModal';
import OnboardingOverlay, { useOnboarding } from './components/OnboardingOverlay';
import { PaletteProvider } from './palette';
import { isTokenExpired } from './components/AuthModal';
import { API_BASE } from './config';

function getValidToken() {
  const t = localStorage.getItem('accessToken');
  if (!t || isTokenExpired()) return null;
  return t;
}

function resolvePageRoute(path, currentRole, therapistStat) {
  // 1. Admin Role Isolation
  if (currentRole === 'admin') {
    return 'admin-dashboard';
  }

  // 2. Allow navigation to home/wellness for all users, including pending therapist applicants
  if (path === '/' || path === '') {
    if (currentRole === 'therapist' && therapistStat === 'verified') {
      return 'therapist-dashboard';
    }
    return 'wellness';
  }

  // 3. Therapist Portal & Onboarding Route Guards
  if (path === '/therapist/dashboard' || path === '/therapist') {
    if (currentRole === 'therapist' || therapistStat === 'verified') {
      return therapistStat === 'verified' ? 'therapist-dashboard' : 'therapist-onboarding';
    }
    if (therapistStat === 'pending' || therapistStat === 'onboarding_required') {
      return 'therapist-onboarding';
    }
    return 'wellness';
  }
  if (path === '/therapist/onboarding') {
    return currentRole ? 'therapist-onboarding' : 'wellness-auth';
  }
  if (path === '/therapist/list' || path === '/therapists') {
    return currentRole ? 'therapist-list' : 'wellness-auth';
  }
  if (path === '/therapist/profile') {
    return currentRole ? 'therapist-profile' : 'wellness-auth';
  }
  if (path === '/therapist/booking') {
    return currentRole ? 'therapist-booking' : 'wellness-auth';
  }
  if (path === '/therapist/auth') {
    return 'therapist-auth';
  }
  if (path === '/exercises') {
    return currentRole ? 'exercises' : 'wellness';
  }
  if (path === '/history') {
    return currentRole ? 'history' : 'wellness';
  }
  if (path === '/my-appointments') {
    return currentRole ? 'my-appointments' : 'wellness';
  }

  return 'wellness';
}

function pageToPath(p) {
  if (p === 'admin-dashboard') return '/admin';
  if (p === 'therapist-dashboard') return '/therapist/dashboard';
  if (p === 'therapist-onboarding') return '/therapist/onboarding';
  if (p === 'therapist-list') return '/therapists';
  if (p === 'therapist-profile') return '/therapist/profile';
  if (p === 'therapist-booking') return '/therapist/booking';
  if (p === 'therapist-auth') return '/therapist/auth';
  if (p === 'exercises') return '/exercises';
  if (p === 'history') return '/history';
  if (p === 'my-appointments') return '/my-appointments';
  return '/';
}

function AppInner() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [token, setToken] = useState(() => getValidToken() ?? '');
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [therapistStatus, setTherapistStatus] = useState(null);

  const [page, setPage] = useState(() => resolvePageRoute(window.location.pathname, null, null));
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [pendingBookingTherapist, setPendingBookingTherapist] = useState(null);
  const [guestName, setGuestName] = useState(() => localStorage.getItem('guest_name') ?? '');
  const [showOnboarding, finishOnboarding] = useOnboarding();

  // Central Session & Role Initialization
  const initSession = useCallback(async (activeTok) => {
    if (!activeTok || isTokenExpired()) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setToken('');
      setUser(null);
      setRole(null);
      setTherapistStatus(null);
      setSessionLoading(false);
      return;
    }

    setSessionLoading(true);
    try {
      // Fetch user profile to get verified role
      const res = await fetch(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${activeTok}` }
      });

      if (!res.ok) throw new Error('Failed to fetch profile');
      const { profile } = await res.json();

      const userObj = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role || 'patient'
      };

      setUser(userObj);
      setRole(userObj.role);
      localStorage.setItem('user', JSON.stringify(userObj));

      // Fetch therapist onboarding request status for all logged-in users
      const onbRes = await fetch(`${API_BASE}/therapist-onboarding/status`, {
        headers: { Authorization: `Bearer ${activeTok}` }
      });
      let requestStatus = null;
      if (onbRes.ok) {
        const onbJson = await onbRes.json();
        requestStatus = onbJson.request?.status;
      }

      // If user is a therapist, check verification status
      if (userObj.role === 'therapist') {
        const thRes = await fetch(`${API_BASE}/therapists/me/profile`, {
          headers: { Authorization: `Bearer ${activeTok}` }
        });

        let isVerified = false;
        if (thRes.ok) {
          const { therapist } = await thRes.json();
          if (therapist && therapist.is_verified) {
            isVerified = true;
          }
        }

        if (isVerified) {
          setTherapistStatus('verified');
        } else if (requestStatus === 'pending') {
          setTherapistStatus('pending');
        } else if (requestStatus === 'onboarding') {
          setTherapistStatus('onboarding_required');
        } else {
          setTherapistStatus('unverified');
        }
      } else {
        if (requestStatus === 'pending') {
          setTherapistStatus('pending');
        } else if (requestStatus === 'onboarding') {
          setTherapistStatus('onboarding_required');
        } else {
          setTherapistStatus(null);
        }
      }
    } catch (err) {
      console.warn('[App] Session initialization error:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setToken('');
      setUser(null);
      setRole(null);
      setTherapistStatus(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const tok = getValidToken();
    initSession(tok);
  }, [initSession]);

  // Navigate helper function
  const navigateToPage = useCallback((newPage, replace = false) => {
    const targetPath = pageToPath(newPage);
    if (replace) {
      window.history.replaceState({ page: newPage }, '', targetPath);
    } else if (window.location.pathname !== targetPath) {
      window.history.pushState({ page: newPage }, '', targetPath);
    }
    setPage(newPage);
  }, []);

  // Handle browser back/forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (sessionLoading) return;
      const targetPage = resolvePageRoute(window.location.pathname, role, therapistStatus);
      setPage(targetPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [sessionLoading, role, therapistStatus]);

  // Enforce central Role Guard whenever session completes or role changes
  useEffect(() => {
    if (sessionLoading) return;

    const targetPage = resolvePageRoute(window.location.pathname, role, therapistStatus);
    if (page !== targetPage) {
      navigateToPage(targetPage, true);
    } else {
      const targetPath = pageToPath(targetPage);
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({ page: targetPage }, '', targetPath);
      }
    }
  }, [sessionLoading, role, therapistStatus, page, navigateToPage]);

  // Auth Success Callback
  const handleAuthSuccess = async (u, newTok) => {
    setToken(newTok);
    await initSession(newTok);
  };

  // Sign Out Callback
  const handleSignOut = () => {
    localStorage.clear();
    setToken('');
    setUser(null);
    setRole(null);
    setTherapistStatus(null);
    setPendingBookingTherapist(null);
    setSelectedTherapist(null);
    navigateToPage('wellness', true);
  };

  // Session Expired Callback (Clears tokens & opens appropriate Auth Modal)
  const handleSessionExpired = useCallback((authMode = 'user') => {
    localStorage.clear();
    setToken('');
    setUser(null);
    setRole(null);
    setTherapistStatus(null);
    setPendingBookingTherapist(null);
    setSelectedTherapist(null);
    if (authMode === 'therapist') {
      navigateToPage('therapist-auth', true);
    } else {
      navigateToPage('wellness-auth', true);
    }
  }, [navigateToPage]);

  const handleBookTherapist = (therapist) => {
    setSelectedTherapist(therapist);
    const validTok = getValidToken();
    if (!validTok) {
      setPendingBookingTherapist(therapist);
      navigateToPage('wellness-auth');
    } else {
      setPendingBookingTherapist(null);
      navigateToPage('therapist-booking');
    }
  };

  // 0. Session Initialization Loading Screen (Prevents Landing Page Flash)
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-md">
              🌿
            </span>
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Launching TherapyxAI...</h3>
            {/* <p className="text-xs text-muted-foreground mt-1">Verifying security credentials and role permissions</p> */}
          </div>
        </div>
      </div>
    );
  }

  if (showOnboarding && !role) {
    return <OnboardingOverlay onDone={finishOnboarding} />;
  }

  // 1. History Page View (PATIENT ROUTE)
  if (page === 'history' && role === 'patient') {
    return (
      <HistoryPage
        token={token}
        onBack={() => navigateToPage('wellness')}
        onOpenTherapistList={() => navigateToPage('therapist-list')}
      />
    );
  }

  // 1.5 Interactive Exercises Page View (LOGGED-IN PROTECTED ROUTE)
  if (page === 'exercises' && role) {
    return (
      <ExercisesPage
        user={user}
        onBack={() => navigateToPage('wellness')}
      />
    );
  }

  // 2. Full-Page Therapist Profile View (PATIENT PROTECTED ROUTE)
  if (page === 'therapist-profile' && role && role !== 'admin' && role !== 'therapist') {
    return (
      <TherapistProfilePage
        therapist={selectedTherapist}
        onBook={handleBookTherapist}
        onBack={() => navigateToPage('wellness')}
      />
    );
  }

  // 3. Full-Page Therapist Appointment Booking View (PATIENT PROTECTED ROUTE)
  if (page === 'therapist-booking' && role && role !== 'admin' && role !== 'therapist') {
    return (
      <TherapistBookingPage
        therapist={selectedTherapist}
        token={token}
        isGuest={!token}
        guestName={guestName}
        onSignIn={() => {
          setPendingBookingTherapist(selectedTherapist);
          navigateToPage('wellness-auth');
        }}
        onViewAppointments={() => navigateToPage('my-appointments')}
        onBack={() => navigateToPage('wellness')}
      />
    );
  }

  // 4. Therapist Onboarding / Status View (THERAPIST PENDING / PATIENT REGISTERING)
  if (page === 'therapist-onboarding') {
    return (
      <TherapistOnboardingPage
        token={token}
        onBack={() => {
          navigateToPage('wellness');
        }}
        onSuccess={() => {
          initSession(token);
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  // 5. Full-Page My Appointments View (PATIENT PROTECTED ROUTE)
  if (page === 'my-appointments' && role === 'patient') {
    return (
      <MyAppointmentsPage
        token={token}
        onBack={() => navigateToPage('wellness')}
        onBookNew={() => navigateToPage('therapist-list')}
        onSessionExpired={() => handleSessionExpired('user')}
      />
    );
  }

  // 6. Full-Page Therapist Practice Portal View (VERIFIED THERAPIST PROTECTED ROUTE)
  if (page === 'therapist-dashboard' && role === 'therapist' && therapistStatus === 'verified') {
    return (
      <TherapistDashboardPage
        token={token}
        onBack={() => navigateToPage('therapist-dashboard')}
        onSignOut={handleSignOut}
        onSessionExpired={() => handleSessionExpired('therapist')}
      />
    );
  }

  // 7. Full-Page Admin Dashboard View (ADMIN PROTECTED ROUTE)
  if (page === 'admin-dashboard' && role === 'admin') {
    return (
      <AdminDashboardPage
        token={token}
        onBack={() => navigateToPage('admin-dashboard')}
        onSignOut={handleSignOut}
      />
    );
  }

  // 8. Public Therapist Discovery Page View (PATIENT PROTECTED ROUTE)
  if (page === 'therapist-list' && role && role !== 'admin' && role !== 'therapist') {
    return (
      <TherapistListPage
        onBack={() => navigateToPage('wellness')}
        onOpenProfile={(therapist) => {
          setSelectedTherapist(therapist);
          navigateToPage('therapist-profile');
        }}
        onBook={handleBookTherapist}
      />
    );
  }

  // Default: Main Wellness Home View (For Patient or Unauthenticated Visitor)
  return (
    <>
      <WellnessPage
        initialAuthOpen={page === 'wellness-auth'}
        onAuthSuccess={handleAuthSuccess}
        onAuthClose={() => navigateToPage('wellness')}
        onSignOut={handleSignOut}
        onOpenHistory={(t) => { if (t) setToken(t); navigateToPage('history'); }}
        onOpenAppointments={() => navigateToPage('my-appointments')}
        onOpenTherapistDashboard={() => navigateToPage('therapist-dashboard')}
        onOpenAdminDashboard={() => navigateToPage('admin-dashboard')}
        onOpenTherapistProfile={(therapist) => {
          if (!role) {
            navigateToPage('wellness-auth');
          } else {
            setSelectedTherapist(therapist);
            navigateToPage('therapist-profile');
          }
        }}
        onOpenTherapistBooking={handleBookTherapist}
        onOpenTherapistOnboarding={() => navigateToPage('therapist-onboarding')}
        onOpenTherapistList={() => {
          if (!role) {
            navigateToPage('wellness-auth');
          } else {
            navigateToPage('therapist-list');
          }
        }}
        onOpenTherapistAuth={() => navigateToPage('therapist-auth')}
        onOpenExercises={() => navigateToPage('exercises')}
      />

      {/* Dedicated Therapist Auth Modal View rendered over Wellness product */}
      {page === 'therapist-auth' && !role && (
        <TherapistAuthModal
          onClose={() => navigateToPage('wellness')}
          onSuccess={handleAuthSuccess}
          onOpenUserAuth={() => navigateToPage('wellness-auth')}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <PaletteProvider>
      <AppInner />
    </PaletteProvider>
  );
}

