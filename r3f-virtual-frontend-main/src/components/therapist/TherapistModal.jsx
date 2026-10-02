import { useState } from 'react';
import { formatINR } from '../../lib/currency';

const SAMPLE_TIMESLOTS = [
  '09:00 AM',
  '10:30 AM',
  '01:00 PM',
  '02:30 PM',
  '04:00 PM',
  '05:30 PM'
];

export default function TherapistModal({
  therapist,
  mode = 'view',
  token,
  isGuest,
  guestName,
  onSignIn,
  onClose
}) {
  const [activeTab, setActiveTab] = useState(mode); // 'view' or 'book'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(SAMPLE_TIMESLOTS[0]);
  const [sessionType, setSessionType] = useState('video');
  const [userNotes, setUserNotes] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirmBooking = (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate appointment creation
    setTimeout(() => {
      setLoading(false);
      setBookingSuccess(true);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border/70 p-6 shadow-2xl text-foreground">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-4 mb-6 pr-8">
          <img
            src={therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
            alt={therapist.full_name}
            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{therapist.full_name}</h2>
              {therapist.is_verified && (
                <span className="bg-emerald-500 text-white p-0.5 rounded-full" title="Verified">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {therapist.title} {therapist.years_of_experience ? `· ${therapist.years_of_experience} yrs exp` : ''}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5 text-primary font-bold">
                🎓 {therapist.years_of_experience || therapist.experience_years || 5}+ yrs exp
              </span>
              <span>· {formatINR(therapist.hourly_rate)}/session</span>
              <span>· {therapist.languages?.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-border/60 mb-5">
          <button
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'view'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Therapist Profile & Details
          </button>
          <button
            onClick={() => setActiveTab('book')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'book'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Book Appointment
          </button>
        </div>

        {/* ── TAB 1: Profile View ── */}
        {activeTab === 'view' && (
          <div className="space-y-4 text-xs sm:text-sm text-foreground/90">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">About Therapist</h4>
              <p className="leading-relaxed">{therapist.bio || therapist.short_headline}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Specialties & Focus Areas</h4>
              <div className="flex flex-wrap gap-1.5">
                {(therapist.specialties || []).map((s, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                <span className="block text-[11px] text-muted-foreground font-semibold uppercase">Consultation Modes</span>
                <span className="font-bold text-xs capitalize mt-0.5 block">
                  {therapist.supported_session_types?.join(', ') || 'Video, Audio, Chat'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                <span className="block text-[11px] text-muted-foreground font-semibold uppercase">Languages Spoken</span>
                <span className="font-bold text-xs mt-0.5 block">
                  {therapist.languages?.join(', ') || 'English'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="px-5 py-2 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg"
                style={{ backgroundImage: 'var(--gradient-primary)' }}
              >
                Proceed to Book
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: Book Appointment ── */}
        {activeTab === 'book' && (
          <div>
            {bookingSuccess ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="text-lg font-bold">Appointment Requested Successfully!</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Your session request for <span className="font-semibold text-foreground">{selectedDate}</span> at <span className="font-semibold text-foreground">{selectedSlot}</span> ({sessionType.toUpperCase()}) has been submitted to {therapist.full_name}.
                </p>
                <div className="pt-4">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="space-y-4 text-xs sm:text-sm">
                {/* Guest Mode Notice */}
                {isGuest && (
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-between text-xs">
                    <span>Booking as Guest: <strong>{guestName || 'Guest User'}</strong></span>
                    {onSignIn && (
                      <button
                        type="button"
                        onClick={onSignIn}
                        className="underline font-bold hover:opacity-80"
                      >
                        Sign in for faster booking
                      </button>
                    )}
                  </div>
                )}

                {/* Session Type Picker */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">Session Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['video', 'audio', 'chat'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSessionType(type)}
                        className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${
                          sessionType === type
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-border/60 hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {type === 'video' ? '📹 Video Call' : type === 'audio' ? '📞 Audio Call' : '💬 Live Chat'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">Select Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    required
                  />
                </div>

                {/* Time Slot Picker */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">Select Time Slot</label>
                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                    {SAMPLE_TIMESLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                          selectedSlot === slot
                            ? 'border-primary bg-primary text-primary-foreground font-bold'
                            : 'border-border/60 hover:bg-muted text-foreground'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patient Notes */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">What would you like to discuss?</label>
                  <textarea
                    rows={2}
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Briefly describe your goals or concerns (optional)..."
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {/* Email input for guest mode */}
                {isGuest && (
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">Your Email (for appointment confirmation)</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. name@example.com"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="pt-3 flex items-center justify-between border-t border-border/40">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Total Fee:</span>{' '}
                    <span className="font-extrabold text-foreground text-sm">{formatINR(therapist.hourly_rate)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg disabled:opacity-50"
                      style={{ backgroundImage: 'var(--gradient-primary)' }}
                    >
                      {loading ? 'Confirming...' : 'Confirm Appointment'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
