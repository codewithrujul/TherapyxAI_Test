import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import PageHeader from '../components/PageHeader';
import { formatINR } from '../lib/currency';

function getTodayDateIST() {
  const d = new Date();
  // Format as YYYY-MM-DD in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(d);
}

export default function TherapistBookingPage({ therapist, token, isGuest, onSignIn, onViewAppointments, onBack }) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateIST());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotObj, setSelectedSlotObj] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [sessionType, setSessionType] = useState('video');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReasonText, setCustomReasonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdAppointment, setCreatedAppointment] = useState(null);

  // Multi-session package state
  const [sessionCount, setSessionCount] = useState(1);
  const [recurringSessions, setRecurringSessions] = useState([]);
  const [recurringValidating, setRecurringValidating] = useState(false);
  const [recurringError, setRecurringError] = useState('');

  // Active booking restriction state
  const [activeTherapistSessionsCount, setActiveTherapistSessionsCount] = useState(0);

  const checkActiveTherapistBooking = async () => {
    if (!token || isGuest || !therapist?.id) {
      setActiveTherapistSessionsCount(0);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/appointments/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const userAppts = json.appointments || [];
        const activeForTherapist = userAppts.filter(
          (a) => a.therapist_id === therapist.id && (a.status === 'pending' || a.status === 'confirmed')
        );
        setActiveTherapistSessionsCount(activeForTherapist.length);
      }
    } catch (err) {
      console.error('[TherapistBookingPage] Active booking check error:', err);
    }
  };

  useEffect(() => {
    if (therapist?.id && token && !isGuest) {
      checkActiveTherapistBooking();
    }
  }, [therapist?.id, token, isGuest]);

  // Fetch slots for therapist and date
  const fetchSlots = async (dateStr) => {
    if (!therapist?.id || !dateStr) return;
    setSlotsLoading(true);
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/therapists/${therapist.id}/slots?date=${dateStr}`, { headers });
      const json = await res.json();
      if (res.ok && json.slots) {
        setAvailableSlots(json.slots);
        // Select first available slot if present
        const firstAvailable = json.slots.find(s => s.isAvailable);
        setSelectedSlotObj(firstAvailable || null);
      }
    } catch (err) {
      console.error('[TherapistBookingPage] Fetch slots error:', err);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (therapist?.id && selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [therapist?.id, selectedDate]);

  // Validate recurring weekly slots when sessionCount > 1 and selectedSlotObj changes
  const validateRecurring = async () => {
    if (!therapist?.id || !selectedSlotObj || sessionCount <= 1) {
      setRecurringSessions([]);
      setRecurringError('');
      return;
    }
    setRecurringValidating(true);
    setRecurringError('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/appointments/validate-recurring-slots`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          therapistId: therapist.id,
          startTimeISO: selectedSlotObj.startTimeISO,
          endTimeISO: selectedSlotObj.endTimeISO,
          sessionCount: sessionCount,
        }),
      });
      const json = await res.json();
      if (json.sessions) {
        setRecurringSessions(json.sessions);
      }
      if (!json.valid) {
        const un = json.unavailableSessions?.[0];
        const unDate = un?.displayDate || un?.date || 'a future week';
        const unTime = un?.displayTime || un?.startTime || '';
        setRecurringError(`Some of your selected weekly sessions are no longer available.\n\nUnavailable:\n${unDate} · ${unTime}\n\nPlease select another starting time.`);
      } else {
        setRecurringError('');
      }
    } catch (err) {
      console.error('[TherapistBookingPage] Recurring slot validation error:', err);
    } finally {
      setRecurringValidating(false);
    }
  };

  useEffect(() => {
    validateRecurring();
  }, [sessionCount, selectedSlotObj?.startTimeISO, therapist?.id]);

  if (!therapist) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
        <PageHeader onBack={onBack} backLabel="Back to Therapists" />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-muted-foreground mb-4">No therapist selected for booking.</p>
          <button
            onClick={onBack}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-all"
          >
            ← Back to Therapists
          </button>
        </main>
      </div>
    );
  }

  // 🔒 PROTECTED ROUTE GUARD FOR GUEST USERS
  if (!token || isGuest) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
        {/* Header — shared across every internal page: back button + theme + profile */}
        <PageHeader onBack={onBack} backLabel="Back to Home" />

        {/* Auth Guard Screen */}
        <main className="flex-1 flex flex-col items-center justify-center gap-3 p-4 sm:p-6 animate-fade-up">
          <span className="text-xs font-semibold text-muted-foreground">Protected feature</span>
          <div className="max-w-md w-full rounded-3xl border border-border/80 bg-card p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                Authentication Required
              </span>
              <h2 className="text-xl font-extrabold text-foreground mt-2">Sign In to Book Appointment</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                Booking a 1-on-1 private therapy session with <strong className="text-foreground">{therapist.full_name}</strong> is a protected action for registered users. Please sign in or create an account to proceed.
              </p>
            </div>

            {/* Therapist Info Badge */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/40 text-left text-xs flex items-center gap-3">
              <img
                src={therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                alt={therapist.full_name}
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div>
                <div className="font-bold text-foreground">{therapist.full_name}</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{therapist.title}</div>
                <div className="text-[11px] text-muted-foreground font-semibold">{formatINR(therapist.hourly_rate)} / 1-hour session</div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={onSignIn}
                className="w-full py-3 text-xs font-extrabold rounded-2xl text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundImage: 'var(--gradient-primary)' }}
              >
                🔑 Sign In / Register Account
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2.5 text-xs font-semibold rounded-2xl border border-border/60 hover:bg-muted text-muted-foreground"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // LOGGED IN USER BOOKING SUBMISSION
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlotObj) {
      setErrorMsg('Please select an available time slot.');
      return;
    }

    if (activeTherapistSessionsCount > 0) {
      setErrorMsg(`You already have active or upcoming session(s) with ${therapist.full_name}. Please complete your existing session(s) before booking a new appointment.`);
      return;
    }

    if (sessionCount > 1 && recurringError) {
      setErrorMsg(recurringError);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const combinedReason = selectedReason === 'Other Reason'
      ? customReasonText.trim()
      : selectedReason && customReasonText.trim()
      ? `${selectedReason} — ${customReasonText.trim()}`
      : selectedReason || customReasonText.trim();

    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          therapistId: therapist.id,
          startTime: selectedSlotObj.startTimeISO,
          endTime: selectedSlotObj.endTimeISO,
          sessionType,
          userNotes: combinedReason,
          feeAmount: therapist.hourly_rate,
          sessionCount: sessionCount
        })
      });

      const json = await res.json();

      if (!res.ok) {
        const errorText = json.error?.message || 'Failed to book appointment.';
        setErrorMsg(errorText);
        // Refresh available slots for stale handling
        fetchSlots(selectedDate);
        return;
      }

      const aptData = json.appointment || {};
      setCreatedAppointment({
        ...aptData,
        totalSessions: json.totalSessions || sessionCount,
        allAppointments: json.appointments || [aptData],
      });
    } catch (err) {
      console.error('[TherapistBookingPage] Booking error:', err);
      setErrorMsg(err.message || 'Failed to submit appointment to backend.');
      fetchSlots(selectedDate);
    } finally {
      setLoading(false);
    }
  };

  const bookingRef = createdAppointment?.appointment_number || createdAppointment?.id;
  const googleMeetUrl = createdAppointment?.googleMeetUrl || createdAppointment?.google_meet_url || createdAppointment?.meeting_link;
  const totalFee = (therapist.hourly_rate || 0) * sessionCount;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* ── Header — shared across every internal page: product logo/icons + theme + profile ── */}
      <PageHeader onBack={onBack} backLabel="Back to Therapists" />

      {/* ── Main Content Container ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 animate-fade-up">
        <p className="mb-4 text-xs font-semibold text-muted-foreground">Appointment scheduling</p>
        {createdAppointment ? (
          /* SUCCESS SCREEN */
          <div className="max-w-md mx-auto rounded-3xl border border-border/70 bg-card p-8 text-center space-y-5 shadow-xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {createdAppointment.totalSessions > 1 ? `${createdAppointment.totalSessions}-Session Package Confirmed!` : 'Appointment Confirmed!'}
              </h2>
              {bookingRef && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your appointment reference is <strong className="text-primary font-mono">{bookingRef}</strong>.
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/40 text-left text-xs space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Therapist:</span> <span className="font-bold">{therapist.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Package Size:</span> <span className="font-bold">{createdAppointment.totalSessions || sessionCount} {createdAppointment.totalSessions > 1 ? 'Weekly Sessions' : 'Single Session'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Start Date:</span> <span className="font-bold">{selectedDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time Slot:</span> <span className="font-bold">{selectedSlotObj?.label || '1-Hour Session'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span> <span className="font-bold">1 Hour per session</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Format:</span> <span className="font-bold capitalize">{sessionType} Session</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Fee:</span> <span className="font-bold">{formatINR(therapist.hourly_rate * (createdAppointment.totalSessions || sessionCount))}</span></div>
            </div>

            {/* List of Created Sessions for Multi-Session Packages */}
            {createdAppointment.allAppointments?.length > 1 && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 text-left text-xs space-y-2 max-h-48 overflow-y-auto">
                <div className="font-extrabold text-foreground uppercase tracking-wider mb-1">Booked Recurring Sessions:</div>
                {createdAppointment.allAppointments.map((apt, idx) => {
                  const dStr = new Date(apt.start_time).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', month: 'short', day: '2-digit' });
                  const tStr = new Date(apt.start_time).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={apt.id || idx} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0 font-medium">
                      <span className="font-bold text-primary">Session {idx + 1} of {createdAppointment.allAppointments.length}</span>
                      <span className="font-mono text-[11px] text-foreground">{dStr} · {tStr}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Google Meet Action Info */}
            {googleMeetUrl ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ Google Meet Video link generated. The <strong>Join Meeting</strong> button will activate in your appointments portal at the scheduled session times.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 text-center">
                <span>⏱️ Preparing Google Meet video space. Check "My Appointments" page to access links during session.</span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              {onViewAppointments && (
                <button
                  type="button"
                  onClick={onViewAppointments}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-card border border-border/60 hover:bg-muted text-foreground transition-all shadow-sm active:scale-95"
                >
                  📅 View My Appointments
                </button>
              )}
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-2.5 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg transition-all active:scale-95"
                style={{ backgroundImage: 'var(--gradient-primary)' }}
              >
                ← Return to Home
              </button>
            </div>
          </div>
        ) : (
          /* BOOKING FORM GRID */
          <div className="space-y-6">
            {activeTherapistSessionsCount > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-100 text-xs font-semibold space-y-2 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
                  <span>⚠️ Active Session Restriction</span>
                </div>
                <p className="leading-relaxed">
                  You currently have <strong>{activeTherapistSessionsCount} active or upcoming session(s)</strong> booked with <strong>{therapist.full_name}</strong>.
                  You cannot book another appointment or package with this therapist until all existing sessions are marked completed.
                </p>
                {onViewAppointments && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onViewAppointments}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 font-bold text-amber-900 dark:text-amber-100 transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>📅 View My Appointments</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left Column: Therapist Summary */}
            <div className="md:col-span-1 space-y-4">
              <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sticky top-24 space-y-4">
                <div className="text-center">
                  <img
                    src={therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                    alt={therapist.full_name}
                    className="w-20 h-20 mx-auto rounded-2xl object-cover ring-2 ring-primary/20 mb-3"
                  />
                  <h3 className="text-base font-bold text-foreground">{therapist.full_name}</h3>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{therapist.title}</p>
                </div>

                <div className="border-t border-border/50 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Session Duration:</span>
                    <span className="font-semibold text-foreground">1 Hour (60 mins)</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Rate / Session:</span>
                    <span className="font-bold text-foreground text-sm">{formatINR(therapist.hourly_rate)}</span>
                  </div>
                  {sessionCount > 1 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Package Rate ({sessionCount} Sessions):</span>
                      <span className="font-extrabold text-primary text-sm">{formatINR(totalFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Timezone:</span>
                    <span className="font-bold text-foreground">Asia/Kolkata (IST)</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Experience:</span>
                    <span className="font-bold text-foreground">{therapist.years_of_experience || therapist.experience_years || 5}+ years</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                  ✓ Verified Practitioner Session
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Schedule Form */}
            <div className="md:col-span-2">
              <form onSubmit={handleConfirmBooking} className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Select Session Type & Time Slot</h2>
                  {/* <p className="text-xs text-muted-foreground">Choose your session package and initial date/time slot for consecutive weekly therapy.</p> */}
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between whitespace-pre-line">
                    <span>⚠️ {errorMsg}</span>
                    <button type="button" onClick={() => fetchSlots(selectedDate)} className="underline text-[11px] font-bold">Refresh Slots</button>
                  </div>
                )}

                {/* ── 1. SESSION PACKAGE SELECTION ── */}
                <div>
                  <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wider">Number of Sessions</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[1, 3, 6, 9].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSessionCount(count)}
                        className={`py-3 px-2 rounded-2xl border text-xs font-extrabold transition-all text-center ${
                          sessionCount === count
                            ? 'border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                            : 'border-border/60 text-foreground hover:bg-muted bg-card'
                        }`}
                      >
                        <div>{count} {count === 1 ? 'Session' : 'Sessions'}</div>
                        <div className="text-[10px] font-semibold opacity-80 mt-0.5">{formatINR(therapist.hourly_rate * count)}</div>
                      </button>
                    ))}
                  </div>
                </div>



                {/* Date Picker */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">
                    {sessionCount > 1 ? 'Select your first session date' : 'Select Appointment Date'}
                  </label>
                  <input
                    type="date"
                    required
                    min={getTodayDateIST()}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40 font-semibold"
                  />
                </div>

                {/* Time Slots */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {sessionCount > 1 ? 'Select first session time slot' : 'Available Hourly Slots (1-Hour Duration)'}
                    </label>
                    {slotsLoading && <span className="text-[11px] text-muted-foreground animate-pulse">Loading slots…</span>}
                  </div>

                  {availableSlots.length === 0 && !slotsLoading ? (
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/40 text-xs text-muted-foreground text-center">
                      No slots available for the selected date. Please choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlotObj?.startTimeISO === slot.startTimeISO;
                        const isDisabled = !slot.isAvailable;

                        let badgeLabel = '';
                        if (slot.reason === 'past') badgeLabel = 'Past';
                        else if (slot.reason === 'booked') badgeLabel = 'Booked';
                        else if (slot.reason === 'user_conflict') badgeLabel = 'Your Conflict';

                        return (
                          <button
                            key={slot.startTimeISO}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setSelectedSlotObj(slot)}
                            className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : isDisabled
                                ? 'border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60'
                                : 'border-border/60 hover:bg-muted text-foreground'
                            }`}
                          >
                            <span>{slot.label}</span>
                            {isDisabled && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/40">
                                {badgeLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── 2. RECURRING WEEKLY SLOTS PREVIEW FOR MULTI-SESSION PACKAGES ── */}
                {sessionCount > 1 && selectedSlotObj && (
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-foreground uppercase tracking-wider">Your sessions ({sessionCount} Sessions Package)</span>
                      {recurringValidating && <span className="text-[11px] text-muted-foreground animate-pulse">Checking weekly availability…</span>}
                    </div>

                    {recurringError && (
                      <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold whitespace-pre-line">
                        ⚠️ {recurringError}
                      </div>
                    )}

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {(recurringSessions.length > 0 ? recurringSessions : Array.from({ length: sessionCount })).map((sess, idx) => {
                        const isSessValid = sess ? sess.available : true;
                        const displayD = sess?.displayDate || `Week ${idx + 1}`;
                        const displayT = sess?.displayTime || selectedSlotObj.label;

                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-bold ${
                              isSessValid
                                ? 'bg-card border-border/60 text-foreground'
                                : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={isSessValid ? 'text-emerald-500 font-extrabold' : 'text-red-500 font-extrabold'}>
                                {isSessValid ? '✓' : '✗'}
                              </span>
                              <span>Session {idx + 1} of {sessionCount}</span>
                            </div>
                            <div className="font-mono text-[11px] font-semibold">
                              {displayD} · {displayT}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── REASON FOR THERAPY / BOOKING ── */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    What would help you today? (Optional)
                  </label>

                  {/* Predefined Reasons Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      'I want to talk about something',
                      'I need help calming down',
                      'I don’t know what I’m feeling',
                      'I just want to check in',
                      'Other Reason',
                    ].map((reasonOption) => {
                      const isSelected = selectedReason === reasonOption;
                      return (
                        <button
                          key={reasonOption}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedReason('');
                            } else {
                              setSelectedReason(reasonOption);
                            }
                          }}
                          className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                            isSelected
                              ? 'border-primary bg-primary/15 text-primary shadow-sm ring-2 ring-primary/20 font-extrabold'
                              : 'border-border/60 text-muted-foreground hover:bg-muted bg-background'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-amber-400/80'}`} />
                            <span>{reasonOption}</span>
                          </div>
                          {isSelected && <span className="text-xs font-extrabold text-primary">✓</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Reason Text Box */}
                  <div>
                    <textarea
                      rows={2}
                      placeholder={selectedReason === 'Other Reason' ? 'Please specify your custom reason...' : 'Add any custom details or notes for the therapist (optional)...'}
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40 font-medium"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-4 flex items-center justify-between border-t border-border/50">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Total Booking Fee ({sessionCount} {sessionCount === 1 ? 'Session' : 'Sessions'}):</span>{' '}
                    <span className="font-extrabold text-foreground text-base">{formatINR(totalFee)}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !selectedSlotObj || !selectedSlotObj.isAvailable || (sessionCount > 1 && !!recurringError) || activeTherapistSessionsCount > 0}
                    className="px-6 py-3 text-xs font-bold rounded-2xl text-primary-foreground shadow-lg hover:shadow-xl disabled:opacity-50 transition-all active:scale-95"
                    style={{ backgroundImage: 'var(--gradient-primary)' }}
                  >
                    {activeTherapistSessionsCount > 0
                      ? '🚫 Complete Current Booking First'
                      : loading
                      ? 'Confirming Appointment...'
                      : 'Confirm Appointment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
