import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import PageHeader from '../components/PageHeader';
import { formatINR } from '../lib/currency';

export default function MyAppointmentsPage({ token, onBack, onBookNew, onSessionExpired }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTokenExpiredState, setIsTokenExpiredState] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  
  // Navigation View State: 'timeline' | 'pending' | 'doctors' | 'all'
  const [viewTab, setViewTab] = useState('timeline');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'active' | 'completed' | 'cancelled'
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  
  // Detail Modal State
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const handleRetry = () => {
    const isTokenErr =
      isTokenExpiredState ||
      errorMsg.toLowerCase().includes('token') ||
      errorMsg.toLowerCase().includes('expired') ||
      errorMsg.toLowerCase().includes('log in') ||
      errorMsg.toLowerCase().includes('unauthorized');

    if (isTokenErr) {
      if (onSessionExpired) {
        onSessionExpired();
      } else {
        localStorage.clear();
        window.location.href = '/';
      }
      return;
    }
    fetchAppointments();
  };

  const handleRetryMeet = async (appointmentId) => {
    setRetryingId(appointmentId);
    try {
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/retry-meet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to create Google Meet space');
      }

      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId
            ? {
                ...apt,
                google_meet_url: json.googleMeetUrl,
                google_meet_status: json.googleMeetStatus || 'created',
                meeting_link: json.googleMeetUrl,
              }
            : apt
        )
      );
      if (selectedAppointment && selectedAppointment.id === appointmentId) {
        setSelectedAppointment((prev) => ({
          ...prev,
          google_meet_url: json.googleMeetUrl,
          google_meet_status: json.googleMeetStatus || 'created',
          meeting_link: json.googleMeetUrl,
        }));
      }
      showToast('Google Meet video link generated!');
    } catch (err) {
      console.error('[MyAppointmentsPage] Retry error:', err);
      showToast(err.message || 'Could not create Google Meet space.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleJoinMeeting = async (appointmentId) => {
    try {
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/meeting-link`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Cannot join meeting at this time');
      }
      if (json.googleMeetUrl) {
        window.open(json.googleMeetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      showToast(err.message || 'Access to meeting link failed');
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setErrorMsg('');
    setIsTokenExpiredState(false);
    try {
      const res = await fetch(`${API_BASE}/appointments/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error?.message || 'Failed to fetch appointments';
        if (res.status === 401 || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('log in')) {
          setIsTokenExpiredState(true);
        }
        throw new Error(msg);
      }
      setAppointments(json.appointments || []);
    } catch (err) {
      console.error('[MyAppointmentsPage] Fetch failed:', err);
      setErrorMsg(err.message || 'Could not load your appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAppointments();
    } else {
      setLoading(false);
    }
  }, [token]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleCancelBooking = async (appointmentId) => {
    setCancellingId(appointmentId);
    try {
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to cancel appointment');
      }

      const cancelledApt = appointments.find(a => a.id === appointmentId);
      const pkgId = cancelledApt?.package_id;

      // Update local state - if part of a package, cancel all sessions in that package
      setAppointments((prev) =>
        prev.map((apt) =>
          (apt.id === appointmentId || (pkgId && apt.package_id === pkgId))
            ? { ...apt, status: 'cancelled', cancelled_by: 'user' }
            : apt
        )
      );
      if (selectedAppointment && (selectedAppointment.id === appointmentId || (pkgId && selectedAppointment.package_id === pkgId))) {
        setSelectedAppointment((prev) => ({ ...prev, status: 'cancelled', cancelled_by: 'user' }));
      }
      setCancelConfirmId(null);
      showToast(pkgId ? 'Package booking cancelled successfully.' : 'Appointment cancelled successfully.');
    } catch (err) {
      console.error('[MyAppointmentsPage] Cancel error:', err);
      showToast(err.message || 'Could not cancel appointment. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'Date TBD';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isAppointmentCompleted = (apt) => {
    if (!apt) return false;
    if (apt.status === 'completed') return true;
    if (apt.status === 'cancelled') return false;
    const endTs = new Date(apt.end_time || apt.start_time).getTime() + (apt.end_time ? 0 : 3600000);
    return !isNaN(endTs) && Date.now() > endTs;
  };

  const getStatusBadge = (apt) => {
    const isComp = isAppointmentCompleted(apt);
    const status = isComp ? 'completed' : (typeof apt === 'string' ? apt : apt?.status);

    switch (status) {
      case 'confirmed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending Confirmation
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Cancelled
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Completed
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border/40 capitalize">
            {status}
          </span>
        );
    }
  };

  // Strictly CONFIRMED upcoming sessions for timeline view (EXCLUDES pending until doctor confirms)
  const confirmedUpcomingAppointments = appointments
    .filter((a) => a.status === 'confirmed' && !isAppointmentCompleted(a))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Pending appointments list awaiting doctor confirmation
  const pendingAppointments = appointments.filter((a) => a.status === 'pending' && !isAppointmentCompleted(a));

  const confirmedUpcomingCount = confirmedUpcomingAppointments.length;
  const completedCount = appointments.filter((a) => isAppointmentCompleted(a)).length;
  const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length;

  // Group Pending Appointments by package_id for the Awaiting Confirmation tab (Consolidates multi-session package into ONE card)
  const getGroupedPendingRequests = () => {
    const groups = [];
    const processedPackageIds = new Set();

    pendingAppointments.forEach((apt) => {
      if (apt.package_id) {
        if (!processedPackageIds.has(apt.package_id)) {
          processedPackageIds.add(apt.package_id);
          const pkgApts = appointments
            .filter((a) => a.package_id === apt.package_id)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
          groups.push({
            isPackage: true,
            packageId: apt.package_id,
            therapist: apt.therapists || {},
            primaryAppointment: pkgApts[0] || apt,
            sessions: pkgApts,
            totalSessionsCount: pkgApts.length,
            totalFee: pkgApts.reduce((sum, item) => sum + (Number(item.fee_amount) || 0), 0),
          });
        }
      } else {
        groups.push({
          isPackage: false,
          primaryAppointment: apt,
          therapist: apt.therapists || {},
          sessions: [apt],
          totalSessionsCount: 1,
          totalFee: Number(apt.fee_amount) || 0,
        });
      }
    });

    return groups;
  };

  const groupedPendingRequests = getGroupedPendingRequests();

  const filteredAppointments = appointments.filter((apt) => {
    const isComp = isAppointmentCompleted(apt);
    if (activeFilter === 'active') return (apt.status === 'pending' || apt.status === 'confirmed') && !isComp;
    if (activeFilter === 'completed') return isComp;
    if (activeFilter === 'cancelled') return apt.status === 'cancelled';
    return true;
  });

  // Group appointments by Therapist for the Doctor Journey View (Excludes pending sessions until confirmed)
  const getTherapistGroupedAppointments = () => {
    const groupsMap = new Map();

    appointments.forEach((apt) => {
      const therapist = apt.therapists || {};
      const therapistId = apt.therapist_id || therapist.id || therapist.full_name || 'unknown';

      if (!groupsMap.has(therapistId)) {
        groupsMap.set(therapistId, {
          therapistId,
          therapist,
          appointments: [],
        });
      }
      groupsMap.get(therapistId).appointments.push(apt);
    });

    return Array.from(groupsMap.values()).map((group) => {
      const sortedApts = group.appointments.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      // Only include CONFIRMED sessions in upcoming list for doctor journey
      const confirmedUpcomingList = sortedApts.filter((a) => a.status === 'confirmed' && !isAppointmentCompleted(a));
      const pendingList = sortedApts.filter((a) => a.status === 'pending' && !isAppointmentCompleted(a));
      const completedList = sortedApts.filter((a) => isAppointmentCompleted(a));
      
      const isTreatmentCompleted = sortedApts.some(a => a.treatment_status === 'completed') || (sortedApts.length > 0 && confirmedUpcomingList.length === 0 && pendingList.length === 0 && completedList.length > 0);
      const isPendingConfirmation = pendingList.length > 0 && confirmedUpcomingList.length === 0;

      return {
        ...group,
        appointments: sortedApts,
        upcomingAppointments: confirmedUpcomingList,
        pendingAppointments: pendingList,
        completedAppointments: completedList.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
        activeCount: confirmedUpcomingList.length,
        pendingCount: pendingList.length,
        completedCount: completedList.length,
        totalCount: sortedApts.length,
        isTreatmentCompleted,
        isPendingConfirmation,
      };
    });
  };

  const therapistGroups = getTherapistGroupedAppointments();
  const activeSelectedDoctor = selectedDoctorId ? therapistGroups.find(g => g.therapistId === selectedDoctorId) : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/60 px-4 sm:px-8 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-sm active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to home</span>
        </button>

        <div className="text-xs font-semibold text-foreground flex items-center gap-2">
          <span>Your appointments</span>
        </div>

        <button
          onClick={onBookNew}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all"
        >
          + Book session
        </button>
      </header>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-xl bg-foreground text-background text-xs font-medium shadow-xl animate-fade-in flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6 animate-fade-up">
        {/* Banner Card */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
              Your appointments
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage your upcoming therapist sessions, view past prescriptions, and check booking status.
            </p>
          </div>

          <button
            onClick={fetchAppointments}
            title="Refresh appointments"
            className="p-2.5 rounded-xl border border-border/60 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setViewTab('timeline')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              viewTab === 'timeline'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Upcoming sessions</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-bold">
              {confirmedUpcomingCount}
            </span>
          </button>

          <button
            onClick={() => setViewTab('pending')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              viewTab === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Waiting for confirmation</span>
            {groupedPendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/30 text-white font-bold">
                {groupedPendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setViewTab('doctors');
              setSelectedDoctorId(null);
            }}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              viewTab === 'doctors'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Therapists & care plan</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-bold">
              {therapistGroups.length}
            </span>
          </button>

          <button
            onClick={() => setViewTab('all')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              viewTab === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>All history</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-bold">
              {appointments.length}
            </span>
          </button>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={handleRetry}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-all text-xs active:scale-95"
            >
              {isTokenExpiredState || errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('log in') ? 'Log In Again' : 'Retry'}
            </button>
          </div>
        )}

        {/* Loading Skeleton State */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 rounded-3xl border border-border/60 bg-card/60 animate-pulse space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-32 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-24 bg-muted rounded-full" />
                </div>
                <div className="h-10 bg-muted/60 rounded-2xl w-full" />
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-border/60 bg-card p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/80 flex items-center justify-center text-3xl">
              🗓️
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground">No Appointments Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                You haven't booked any therapy appointments yet.
              </p>
            </div>
            <button
              onClick={onBookNew}
              className="px-6 py-2.5 text-xs font-bold rounded-2xl text-primary-foreground shadow-md hover:shadow-lg transition-all"
              style={{ backgroundImage: 'var(--gradient-primary)' }}
            >
              Browse Therapists & Book
            </button>
          </div>
        ) : viewTab === 'timeline' ? (
          /* ── 1. CONFIRMED UPCOMING SESSION TIMELINE VIEW (EXCLUDES UNCONFIRMED PENDING SESSIONS) ── */
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-3xl border border-primary/20 bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Confirmed Session Timeline</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Chronological timeline of doctor-confirmed sessions. Click any session card to open full details or join video calls.
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
                {confirmedUpcomingCount} Confirmed {confirmedUpcomingCount === 1 ? 'Session' : 'Sessions'}
              </span>
            </div>

            {confirmedUpcomingAppointments.length === 0 ? (
              <div className="rounded-3xl border border-border/60 bg-card p-10 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl">
                  ⏳
                </div>
                <h3 className="text-base font-extrabold">No Confirmed Upcoming Sessions</h3>
                <p className="text-xs text-muted-foreground">
                  {groupedPendingRequests.length > 0
                    ? `You have ${groupedPendingRequests.length} booking request(s) awaiting doctor confirmation. Check the 'Awaiting Confirmation' tab.`
                    : 'You currently have no confirmed upcoming therapy sessions.'}
                </p>
                {groupedPendingRequests.length > 0 ? (
                  <button
                    onClick={() => setViewTab('pending')}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-white shadow transition-all"
                  >
                    View Awaiting Confirmation ({groupedPendingRequests.length})
                  </button>
                ) : (
                  <button
                    onClick={onBookNew}
                    className="px-5 py-2 text-xs font-bold rounded-xl text-primary-foreground shadow transition-all"
                    style={{ backgroundImage: 'var(--gradient-primary)' }}
                  >
                    Book Next Session
                  </button>
                )}
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-primary/20">
                {confirmedUpcomingAppointments.map((apt) => {
                  const therapist = apt.therapists || {};
                  const tName = therapist.full_name || 'Clinical Practitioner';
                  const tTitle = therapist.title || 'Therapist';
                  const tPic = therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

                  const nowTs = Date.now();
                  const startTs = new Date(apt.start_time).getTime();
                  const endTs = new Date(apt.end_time).getTime();
                  const isBeforeStart = !isNaN(startTs) && nowTs < (startTs - 15 * 60000);
                  const isAfterSession = !isNaN(endTs) && nowTs >= endTs;
                  const isDuringSession = !isBeforeStart && !isAfterSession;

                  return (
                    <div key={apt.id} className="relative group">
                      {/* Timeline Dot Node */}
                      <div className={`absolute -left-6 sm:-left-8 top-5 w-4 h-4 rounded-full border-2 bg-background flex items-center justify-center transition-all ${
                        isDuringSession ? 'border-emerald-500 bg-emerald-500 animate-ping' : 'border-primary bg-primary'
                      }`} />

                      {/* Timeline Session Card */}
                      <div
                        onClick={() => setSelectedAppointment(apt)}
                        className="rounded-3xl border border-border/70 bg-card hover:border-primary/40 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-4 group-hover:translate-x-1"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={tPic}
                              alt={tName}
                              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-primary/20"
                            />
                            <div>
                              <h3 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                                {tName}
                              </h3>
                              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                {tTitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {apt.session_number && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                                Session {apt.session_number}
                              </span>
                            )}
                            {getStatusBadge(apt)}
                          </div>
                        </div>

                        {/* Date & Location Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Scheduled Time</span>
                            <span className="font-extrabold text-foreground mt-0.5 block flex items-center gap-1.5">
                              <span>⏰</span>
                              <span>{formatDateTime(apt.start_time)}</span>
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Format & Status</span>
                            <span className="font-bold text-foreground mt-0.5 block capitalize">
                              {apt.session_type || 'Video'} Consultation ({formatINR(apt.fee_amount || therapist.hourly_rate || 0)})
                            </span>
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                          <span className="text-primary font-bold hover:underline flex items-center gap-1">
                            <span>🔍 View Appointment Details</span>
                            <span>→</span>
                          </span>

                          {isDuringSession && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinMeeting(apt.id);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm active:scale-95 text-xs flex items-center gap-1"
                            >
                              <span>📹 Join Live Call</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewTab === 'pending' ? (
          /* ── 2. AWAITING CONFIRMATION SEPARATE TAB (CONSOLIDATED CARDS WITH SINGLE CANCEL OPTION) ── */
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-3xl border border-amber-500/30 bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Requests Awaiting Doctor Confirmation</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Once your therapist confirms your requested session slot, it will move to your Confirmed Upcoming Session Timeline.
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 self-start sm:self-auto">
                {groupedPendingRequests.length} Pending Booking {groupedPendingRequests.length === 1 ? 'Request' : 'Requests'}
              </span>
            </div>

            {groupedPendingRequests.length === 0 ? (
              <div className="rounded-3xl border border-border/60 bg-card p-12 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center text-2xl">
                  ✓
                </div>
                <h3 className="text-base font-extrabold text-foreground">No Pending Requests</h3>
                <p className="text-xs text-muted-foreground">You have no appointment or package requests awaiting doctor confirmation.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedPendingRequests.map((group) => {
                  const therapist = group.therapist || {};
                  const tName = therapist.full_name || 'Clinical Practitioner';
                  const tTitle = therapist.title || 'Therapist';
                  const tPic = therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
                  const primaryApt = group.primaryAppointment;
                  const isPkg = group.isPackage;

                  // 24-Hour cancellation policy check based on FIRST session start time
                  const firstSessionStartTs = new Date(primaryApt.start_time).getTime();
                  const hoursUntilFirstSession = (firstSessionStartTs - Date.now()) / (1000 * 60 * 60);
                  const isCanBeCancelled = hoursUntilFirstSession >= 24;

                  return (
                    <div
                      key={group.packageId || primaryApt.id}
                      className="rounded-3xl border border-amber-500/30 bg-card p-6 shadow-sm hover:shadow-md transition-all space-y-5"
                    >
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <img
                            src={tPic}
                            alt={tName}
                            className="w-12 h-12 rounded-2xl object-cover ring-2 ring-amber-500/20"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-foreground">{tName}</h3>
                              {isPkg && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  {group.totalSessionsCount}-Session Package Request
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{tTitle}</p>
                            <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                              Ref: {primaryApt.appointment_number || primaryApt.id}
                            </span>
                          </div>
                        </div>

                        <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          <span>⏳ Awaiting Doctor Confirmation</span>
                        </span>
                      </div>

                      {/* Card Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/40 text-xs">
                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                            {isPkg ? 'First Session Date' : 'Scheduled Time'}
                          </span>
                          <span className="font-extrabold text-foreground mt-0.5 block">
                            {formatDateTime(primaryApt.start_time)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Format & Fee</span>
                          <span className="font-bold text-foreground mt-0.5 block capitalize">
                            {primaryApt.session_type || 'Video'} ({isPkg ? `${group.totalSessionsCount} Sessions @ ${formatINR(group.totalFee)}` : formatINR(primaryApt.fee_amount || therapist.hourly_rate || 0)})
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Total Sessions</span>
                          <span className="font-bold text-foreground mt-0.5 block">
                             {group.totalSessionsCount}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Weekly Sessions Schedule for Multi-Session Package Request */}
                      {isPkg && group.sessions.length > 0 && (
                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 space-y-2 text-xs">
                          <span className="font-extrabold text-foreground uppercase tracking-wider block mb-1">
                            Weekly Session Schedule Requested:
                          </span>
                          <div className="space-y-1.5">
                            {group.sessions.map((s, idx) => (
                              <div key={s.id || idx} className="flex justify-between items-center py-1.5 px-3 rounded-xl bg-card border border-border/50 font-medium">
                                <span className="font-bold text-amber-600 dark:text-amber-400">Session {idx + 1} of {group.totalSessionsCount}</span>
                                <span className="font-mono text-[11px] text-foreground">{formatDateTime(s.start_time)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pre-Session User Reason */}
                      <div className="text-xs text-muted-foreground p-3 rounded-xl bg-background/50 border border-border/40">
                        <strong className="text-foreground">Appointment Reason:</strong>{' '}
                        {primaryApt.user_notes ? (
                          <span className="text-foreground font-medium">"{primaryApt.user_notes}"</span>
                        ) : (
                          <em className="text-muted-foreground font-normal">No appointment reason provided</em>
                        )}
                      </div>

                      {/* Single Consolidated Cancellation Action Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {isCanBeCancelled ? '✓ Active for cancellation (>24h to session)' : '🔒 Cancellation closed (<24h to session)'}
                        </span>

                        {isCanBeCancelled ? (
                          cancelConfirmId === primaryApt.id ? (
                            <div className="flex items-center gap-2 animate-fade-in">
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                Confirm cancelling {isPkg ? 'entire package' : 'request'}?
                              </span>
                              <button
                                type="button"
                                disabled={cancellingId === primaryApt.id}
                                onClick={() => handleCancelBooking(primaryApt.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all shadow-md"
                              >
                                {cancellingId === primaryApt.id ? 'Cancelling...' : 'Yes, Cancel'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelConfirmId(null)}
                                className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-muted-foreground text-xs font-semibold hover:bg-muted"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancelConfirmId(primaryApt.id)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all active:scale-95"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                              </svg>
                              <span>{isPkg ? 'Cancel Package Booking Request' : 'Cancel Booking Request'}</span>
                            </button>
                          )
                        ) : (
                          <span className="px-3.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                            <span>🔒 Cancellation Closed (&lt;24h to session)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewTab === 'doctors' ? (
          /* ── 3. DOCTOR CONSULTATIONS & PATIENT JOURNEY VIEW (EXCLUDES UNCONFIRMED PENDING SESSIONS) ── */
          <div className="space-y-6 animate-fade-in">
            {activeSelectedDoctor ? (
              /* Single Doctor Journey Detail Sub-View */
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => setSelectedDoctorId(null)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold text-foreground transition-all shadow-sm"
                >
                  ← Back to All Doctors List
                </button>

                {/* Selected Doctor Header */}
                <div className="rounded-3xl border border-primary/30 bg-card p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={activeSelectedDoctor.therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                        alt={activeSelectedDoctor.therapist.full_name || 'Therapist'}
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/30"
                      />
                      <div>
                        <h2 className="text-xl font-extrabold text-foreground">
                          {activeSelectedDoctor.therapist.full_name || 'Dr. Practitioner'}
                        </h2>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {activeSelectedDoctor.therapist.title || 'Therapist'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activeSelectedDoctor.therapist.email || ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {activeSelectedDoctor.isTreatmentCompleted ? (
                        <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1.5">
                          <span>🏁 Treatment Journey Completed</span>
                        </span>
                      ) : activeSelectedDoctor.isPendingConfirmation ? (
                        <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>⏳ Awaiting Doctor Confirmation</span>
                        </span>
                      ) : (
                        <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active Consultation</span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-medium">
                        {activeSelectedDoctor.totalCount} Total Sessions Booked
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-muted/40 border border-border/40 text-center text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Total Sessions</span>
                      <span className="font-extrabold text-foreground text-sm mt-0.5 block">{activeSelectedDoctor.totalCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Confirmed</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 block">{activeSelectedDoctor.activeCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Completed</span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400 text-sm mt-0.5 block">{activeSelectedDoctor.completedCount}</span>
                    </div>
                  </div>
                </div>

                {/* Pending Confirmation Callout Banner if requests are pending */}
                {activeSelectedDoctor.pendingAppointments.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏳</span>
                      <span className="font-bold text-amber-800 dark:text-amber-200">
                        You have {activeSelectedDoctor.pendingAppointments.length} session booking request(s) with {activeSelectedDoctor.therapist.full_name || 'this doctor'} currently awaiting confirmation.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewTab('pending')}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-white font-extrabold text-xs shadow hover:bg-amber-600 transition-all shrink-0 active:scale-95"
                    >
                      View Pending Requests
                    </button>
                  </div>
                )}

                {/* Confirmed Upcoming Sessions with this Doctor */}
                {activeSelectedDoctor.upcomingAppointments.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                      <span>📅 Confirmed Upcoming Sessions</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-600 font-bold">
                        {activeSelectedDoctor.upcomingAppointments.length}
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {activeSelectedDoctor.upcomingAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          onClick={() => setSelectedAppointment(apt)}
                          className="p-5 rounded-2xl bg-card border border-border/60 hover:border-primary/40 cursor-pointer shadow-sm hover:shadow transition-all space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-foreground text-sm">{formatDateTime(apt.start_time)}</div>
                            {getStatusBadge(apt)}
                          </div>
                          <p className="text-xs text-muted-foreground">Reason: "{apt.user_notes || 'General Therapy Session'}"</p>
                          <div className="text-xs font-bold text-primary flex items-center justify-between pt-1">
                            <span>View Details →</span>
                            {apt.session_number && <span>Session {apt.session_number}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Sessions & Doctor Remarks */}
                <div className="space-y-4">
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <span>🩺 Completed Sessions & Doctor Prescriptions</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs bg-sky-500/10 text-sky-600 font-bold">
                      {activeSelectedDoctor.completedAppointments.length}
                    </span>
                  </h3>

                  {activeSelectedDoctor.completedAppointments.length === 0 ? (
                    <div className="p-8 rounded-3xl border border-border/60 bg-card text-center space-y-2">
                      <p className="text-xs text-muted-foreground italic">No completed sessions with this doctor yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeSelectedDoctor.completedAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          onClick={() => setSelectedAppointment(apt)}
                          className="p-5 rounded-2xl bg-card border border-sky-500/30 hover:border-sky-500/60 cursor-pointer shadow-sm hover:shadow transition-all space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-extrabold text-foreground text-sm block">{formatDateTime(apt.start_time)}</span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                Ref: {apt.appointment_number || apt.id} {apt.session_number ? `· Session ${apt.session_number}` : ''}
                              </span>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20">
                              ✓ Session Completed
                            </span>
                          </div>

                          {/* Doctor Remarks & Prescription Quick Callouts */}
                          {(apt.clinical_notes || apt.doctor_remarks || apt.doctor_suggestions || apt.doctor_prescription) ? (
                            <div className="space-y-2">
                              {(apt.clinical_notes || apt.doctor_remarks) && (
                                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
                                  <strong className="text-indigo-900 dark:text-indigo-200 block font-extrabold">📝 Doctor Remarks:</strong>
                                  <p className="mt-0.5 whitespace-pre-wrap">{apt.doctor_remarks || apt.clinical_notes}</p>
                                </div>
                              )}
                              {apt.doctor_suggestions && (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                                  <strong className="text-amber-900 dark:text-amber-200 block font-extrabold">💡 Doctor Suggestions / Advice:</strong>
                                  <p className="mt-0.5 whitespace-pre-wrap">{apt.doctor_suggestions}</p>
                                </div>
                              )}
                              {apt.doctor_prescription && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                                  <strong className="text-emerald-900 dark:text-emerald-200 block font-extrabold">💊 Prescription / Recommendations:</strong>
                                  <p className="mt-0.5 whitespace-pre-wrap">{apt.doctor_prescription}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground italic">
                              No doctor remarks or prescription recorded for this session yet.
                            </div>
                          )}

                          <div className="text-xs font-bold text-primary flex items-center justify-end">
                            <span>Open Full Prescription & Remarks Modal →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Doctor Directory Cards List */
              <div className="space-y-6">
                <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
                  <h2 className="text-lg font-extrabold text-foreground">Ongoing & Past Consultations by Doctor</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a doctor to view segregated patient journey records, appointment history, and clinical prescriptions.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {therapistGroups.map((group) => {
                    const therapist = group.therapist || {};
                    const tName = therapist.full_name || 'Clinical Practitioner';
                    const tTitle = therapist.title || 'Therapist';
                    const tPic = therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

                    return (
                      <div
                        key={group.therapistId}
                        className="rounded-3xl border border-primary/20 bg-card p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={tPic}
                              alt={tName}
                              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-primary/20"
                            />
                            <div>
                              <h3 className="text-base font-extrabold text-foreground">{tName}</h3>
                              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                {tTitle}
                              </p>
                            </div>
                          </div>

                          {group.isTreatmentCompleted ? (
                            <span className="px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1">
                              <span>🏁 Treatment Completed</span>
                            </span>
                          ) : group.isPendingConfirmation ? (
                            <span className="px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>⏳ Awaiting Confirmation</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active Consultation</span>
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-muted/40 border border-border/40 text-center text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Total Sessions</span>
                            <span className="font-extrabold text-foreground mt-0.5 block">{group.totalCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Confirmed</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{group.activeCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Completed</span>
                            <span className="font-extrabold text-sky-600 dark:text-sky-400 mt-0.5 block">{group.completedCount}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedDoctorId(group.therapistId)}
                          className="w-full py-2.5 px-4 text-xs font-bold rounded-2xl bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                          <span>🩺 View Consultation Journey →</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── 4. ALL APPOINTMENTS VIEW WITH FILTERS ── */
          <div className="space-y-6 animate-fade-in">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  activeFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                All Appointments ({appointments.length})
              </button>
              <button
                onClick={() => setActiveFilter('active')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  activeFilter === 'active'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                Confirmed & Pending ({appointments.filter(a => (a.status === 'pending' || a.status === 'confirmed') && !isAppointmentCompleted(a)).length})
              </button>
              <button
                onClick={() => setActiveFilter('completed')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  activeFilter === 'completed'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                Completed ({completedCount})
              </button>
              <button
                onClick={() => setActiveFilter('cancelled')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  activeFilter === 'cancelled'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                Cancelled ({cancelledCount})
              </button>
            </div>

            {/* Appointments List */}
            <div className="space-y-4">
              {filteredAppointments.map((apt) => {
                const therapist = apt.therapists || {};
                const tName = therapist.full_name || 'Clinical Practitioner';
                const tTitle = therapist.title || 'Therapist';
                const tPic = therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
                const isComp = isAppointmentCompleted(apt);

                return (
                  <div
                    key={apt.id}
                    onClick={() => setSelectedAppointment(apt)}
                    className="p-6 rounded-3xl border border-border/70 bg-card hover:border-primary/40 cursor-pointer shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={tPic}
                          alt={tName}
                          className="w-12 h-12 rounded-2xl object-cover ring-2 ring-primary/20"
                        />
                        <div>
                          <h3 className="text-base font-extrabold text-foreground">{tName}</h3>
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{tTitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {apt.session_number && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                            Session {apt.session_number}
                          </span>
                        )}
                        {getStatusBadge(apt)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Date & Time</span>
                        <span className="font-bold text-foreground mt-0.5 block">{formatDateTime(apt.start_time)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Type & Fee</span>
                        <span className="font-bold text-foreground mt-0.5 block capitalize">{apt.session_type || 'Video'} ({formatINR(apt.fee_amount || 0)})</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Ref Code</span>
                        <span className="font-bold font-mono text-foreground mt-0.5 block">{apt.appointment_number || apt.id}</span>
                      </div>
                    </div>

                    {(isComp && (apt.clinical_notes || apt.doctor_remarks || apt.doctor_suggestions || apt.doctor_prescription)) && (
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
                        <strong className="block font-extrabold">🩺 Doctor Prescriptions & Remarks Available</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── APPOINTMENT DETAIL STATUS MODAL (WITH DOCTOR REMARKS & PRESCRIPTION) ── */}
      {selectedAppointment && (() => {
        const apt = selectedAppointment;
        const therapist = apt.therapists || {};
        const tName = therapist.full_name || 'Clinical Practitioner';
        const tTitle = therapist.title || 'Therapist';
        const tPic = therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
        const isComp = isAppointmentCompleted(apt);

        const hoursUntilStart = (new Date(apt.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
        const isWithin24h = hoursUntilStart < 24;
        const isCanBeCancelled = (apt.status === 'pending' || apt.status === 'confirmed') && !isComp && !isWithin24h;

        const nowTs = Date.now();
        const startTs = new Date(apt.start_time).getTime();
        const endTs = new Date(apt.end_time).getTime();
        const isBeforeStart = !isNaN(startTs) && nowTs < (startTs - 15 * 60000);
        const isAfterSession = !isNaN(endTs) && nowTs >= endTs;
        const isDuringSession = !isBeforeStart && !isAfterSession;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-card border border-border/80 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Modal Header */}
              <div className="p-6 border-b border-border/60 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3.5">
                  <img src={tPic} alt={tName} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-primary/20" />
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">{tName}</h3>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{tTitle}</p>
                    <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">Ref: {apt.appointment_number || apt.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAppointment(null)}
                  className="w-8 h-8 rounded-full border border-border/60 hover:bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Status & Session Badge */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/40">
                  <span className="font-extrabold text-foreground">Appointment Status</span>
                  {getStatusBadge(apt)}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-muted/20 border border-border/40">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Scheduled Date & Time</span>
                    <span className="font-extrabold text-foreground mt-0.5 block">{formatDateTime(apt.start_time)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Session Format & Fee</span>
                    <span className="font-extrabold text-foreground mt-0.5 block capitalize">{apt.session_type || 'Video'} ({formatINR(apt.fee_amount || 0)})</span>
                  </div>
                </div>

                {/* Patient Booking Notes */}
                <div className="p-3.5 rounded-2xl bg-background border border-border/50 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Your Pre-Session Reason / Concern:</span>
                  <p className="font-medium text-foreground italic">{apt.user_notes ? `"${apt.user_notes}"` : 'No pre-session reason entered.'}</p>
                </div>

                {/* Video Meeting Section */}
                {!isComp && apt.status !== 'cancelled' && (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                    <span className="font-extrabold text-foreground block">📹 Google Meet Link</span>
                    {apt.status === 'confirmed' && isDuringSession ? (
                      <button
                        type="button"
                        onClick={() => handleJoinMeeting(apt.id)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span>📹 Join Live Video Meeting Now</span>
                      </button>
                    ) : apt.status === 'pending' ? (
                      <p className="text-amber-600 dark:text-amber-400 font-medium">
                        ⏳ Video link will become active once doctor confirms appointment.
                      </p>
                    ) : isBeforeStart ? (
                      <p className="text-amber-600 dark:text-amber-400 font-medium">
                        ⏱️ Meeting link activates 15 minutes before the session start time.
                      </p>
                    ) : (
                      <p className="text-muted-foreground italic">Session time passed.</p>
                    )}
                  </div>
                )}

                {/* Doctor Remarks, Suggestions & Prescriptions Section */}
                {isComp && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                      <span>🩺 Doctor Clinical Summary & Prescription</span>
                    </h4>

                    {(apt.clinical_notes || apt.doctor_remarks) && (
                      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1 text-indigo-800 dark:text-indigo-200">
                        <span className="font-extrabold text-[11px] uppercase tracking-wider block">📝 Clinical Remarks:</span>
                        <p className="whitespace-pre-wrap font-medium">{apt.doctor_remarks || apt.clinical_notes}</p>
                      </div>
                    )}

                    {apt.doctor_suggestions && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-amber-900 dark:text-amber-200">
                        <span className="font-extrabold text-[11px] uppercase tracking-wider block">💡 Doctor Suggestions & Advice:</span>
                        <p className="whitespace-pre-wrap font-medium">{apt.doctor_suggestions}</p>
                      </div>
                    )}

                    {apt.doctor_prescription && (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1 text-emerald-900 dark:text-emerald-200">
                        <span className="font-extrabold text-[11px] uppercase tracking-wider block">💊 Doctor Prescription / Care Plan:</span>
                        <p className="whitespace-pre-wrap font-medium">{apt.doctor_prescription}</p>
                      </div>
                    )}

                    {(!apt.clinical_notes && !apt.doctor_remarks && !apt.doctor_suggestions && !apt.doctor_prescription) && (
                      <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-muted-foreground italic text-center">
                        Doctor has completed this session. Clinical remarks or prescription will be uploaded shortly.
                      </div>
                    )}
                  </div>
                )}

                {/* Cancellation Section */}
                {isCanBeCancelled && (
                  <div className="pt-3 border-t border-border/40 flex justify-end">
                    {cancelConfirmId === apt.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-600">Cancel booking?</span>
                        <button
                          type="button"
                          disabled={cancellingId === apt.id}
                          onClick={() => handleCancelBooking(apt.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
                        >
                          {cancellingId === apt.id ? 'Cancelling...' : 'Yes, Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelConfirmId(null)}
                          className="px-3 py-1.5 rounded-xl border text-xs"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(apt.id)}
                        className="px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 font-bold text-xs hover:bg-rose-500/20"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border/60 bg-muted/30 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAppointment(null)}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-card border border-border/60 hover:bg-muted text-foreground transition-all"
                >
                  Close Detail View
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
