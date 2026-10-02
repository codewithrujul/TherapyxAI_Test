import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../../config';
import { formatINR } from '../../lib/currency';
import TherapistModal from './TherapistModal';
import TherapistOnboardingWizardModal from './TherapistOnboardingWizardModal';

export default function TherapistCarousel({
  token,
  isGuest,
  guestName,
  userRole,
  onSignIn,
  onOpenProfile,
  onOpenBooking,
  onOpenOnboarding,
  onOpenTherapistList
}) {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [modalMode, setModalMode] = useState('view'); // 'view' or 'book'
  const [showDevOnboarding, setShowDevOnboarding] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  const scrollRef = useRef(null);

  // Mouse & Touch Drag state for finger swipe on carousel
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);

  const handleMouseDown = (e) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftPos(scrollRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftPos - walk;
  };

  // Mobile viewport detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch therapists from backend API
  const fetchTherapists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/therapists?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setTherapists(data.therapists || []);
      } else {
        setTherapists([]);
      }
    } catch (err) {
      console.warn('[TherapistCarousel] Backend offline or fetch failed:', err.message);
      setTherapists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTherapists();
  }, [fetchTherapists]);

  // Filter therapists
  const filteredTherapists = therapists.filter(t => {
    const matchesSearch = !searchQuery || 
      t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.specialties?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSpecialty = selectedSpecialty === 'All' || 
      t.specialties?.includes(selectedSpecialty);

    return matchesSearch && matchesSpecialty;
  });

  // Limit cards to max 4 on mobile view
  const displayedTherapists = isMobile ? filteredTherapists.slice(0, 4) : filteredTherapists;

  // Extract unique specialties
  const allSpecialties = ['All', ...new Set(therapists.flatMap(t => t.specialties || []))].slice(0, 7);

  // Carousel scroll functions
  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const handleOpenBooking = (therapist) => {
    if (isGuest || !token) {
      if (onSignIn) onSignIn();
      return;
    }
    if (onOpenBooking) {
      onOpenBooking(therapist);
    } else {
      setSelectedTherapist(therapist);
      setModalMode('book');
    }
  };

  const handleOpenProfile = (therapist) => {
    if (isGuest || !token) {
      if (onSignIn) onSignIn();
      return;
    }
    if (onOpenProfile) {
      onOpenProfile(therapist);
    } else {
      setSelectedTherapist(therapist);
      setModalMode('view');
    }
  };

  const handleViewAllTherapists = () => {
    if (isGuest || !token) {
      if (onSignIn) onSignIn();
      return;
    }
    if (onOpenTherapistList) onOpenTherapistList();
  };

  const handleOpenOnboarding = () => {
    if (onOpenOnboarding) {
      onOpenOnboarding();
    } else {
      setShowDevOnboarding(true);
    }
  };

  return (
    <section className="w-full max-w-6xl mx-auto my-8 px-4 sm:px-6 animate-fade-up">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-normal tracking-tight text-foreground">
            Find a therapist
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with verified clinical psychologists and counselors.
          </p>
        </div>

        {/* Top Actions & Desktop Carousel Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap ml-auto sm:ml-0">
          {onOpenTherapistList && (
            <button
              type="button"
              onClick={handleViewAllTherapists}
              className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs flex items-center gap-2"
            >
              <span>View therapists</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          )}

          {token && userRole === 'admin' && (
            <button
              type="button"
              onClick={handleOpenOnboarding}
              className="px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Open Admin Therapist Onboarding Wizard"
            >
              <span>➕ Add Therapist (Admin)</span>
            </button>
          )}

          {/* Navigation Arrows (Visible on all screen sizes in top header) */}
          <div className="flex items-center gap-2">
            <button
              onClick={scrollLeft}
              aria-label="Scroll left"
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-border/60 bg-background/80 hover:bg-muted text-foreground transition-all shadow-xs active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <button
              onClick={scrollRight}
              aria-label="Scroll right"
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-border/60 bg-background/80 hover:bg-muted text-foreground transition-all shadow-xs active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Tags & Search Input (HIDDEN ON MOBILE VIEW) ── */}
      <div className="hidden sm:flex sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Specialty Tags */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {allSpecialties.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedSpecialty === spec
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {spec}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px] sm:w-64">
          <input
            type="text"
            placeholder="Search therapist or issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border/60 bg-background/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
      </div>

      {/* ── Cards Carousel Container ── */}
      {loading ? (
        <div className="flex items-center justify-center h-64 border border-dashed border-border/60 rounded-3xl">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs">Loading verified therapists...</span>
          </div>
        </div>
      ) : displayedTherapists.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/60 rounded-3xl text-muted-foreground">
          <p className="text-sm">No therapists found matching your search criteria.</p>
          <button
            onClick={() => { setSelectedSpecialty('All'); setSearchQuery(''); }}
            className="mt-2 text-xs font-semibold text-primary underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="relative group/carousel w-full">

          <div
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className={`flex items-stretch gap-4 overflow-x-auto snap-x snap-mandatory py-2 px-1 no-scrollbar touch-pan-x cursor-grab active:cursor-grabbing select-none ${isDragging ? '' : 'scroll-smooth'}`}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain'
            }}
          >
            {displayedTherapists.map((therapist) => (
              <div
                key={therapist.id}
                className="snap-center shrink-0 w-[calc(100vw-3.2rem)] sm:w-[330px] flex flex-col justify-between rounded-3xl border border-border/70 bg-card/80 backdrop-blur-md p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div>
                  {/* Header Profile Photo & Badges */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="relative">
                      <img
                        src={therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
                        alt={therapist.full_name}
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary/20 shadow-md group-hover:scale-105 transition-transform"
                      />
                      {therapist.is_verified && (
                        <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow-sm" title="Verified Professional">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Experience & Fee */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-primary font-bold text-xs">
                        <span>🎓 {therapist.years_of_experience || therapist.experience_years || 5}+ yrs exp</span>
                      </div>
                      <div className="mt-1 text-sm font-extrabold text-foreground">
                        {formatINR(therapist.hourly_rate)} <span className="text-[11px] font-normal text-muted-foreground">/ session</span>
                      </div>
                    </div>
                  </div>

                  {/* Name & Title */}
                  <h3 className="text-lg font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {therapist.full_name}
                  </h3>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    {therapist.title} {therapist.years_of_experience ? `· ${therapist.years_of_experience} yrs exp` : ''}
                  </p>

                  {/* Short Headline / Bio */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    {therapist.short_headline || therapist.bio || 'Empathetic professional providing online mental health consultation.'}
                  </p>

                  {/* Specialties Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {(therapist.specialties || ['Therapy', 'Mental Health']).slice(0, 3).map((spec, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-secondary/80 text-secondary-foreground"
                      >
                        {spec}
                      </span>
                    ))}
                    {(therapist.specialties?.length || 0) > 3 && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-muted text-muted-foreground">
                        +{(therapist.specialties.length - 3)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleOpenProfile(therapist)}
                    className="flex-1 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                  >
                    View profile
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBooking(therapist)}
                    className="flex-1 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs flex items-center justify-center gap-1"
                  >
                    <span>Book session</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* End Item: View All Button Slide */}
            {onOpenTherapistList && (
              <div className="snap-center shrink-0 flex flex-col items-center justify-center py-6 px-4 min-w-[130px] sm:min-w-[160px]">
                <button
                  type="button"
                  onClick={handleViewAllTherapists}
                  className="px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>View all</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Therapist Details / Booking Modal ── */}
      {selectedTherapist && (
        <TherapistModal
          therapist={selectedTherapist}
          mode={modalMode}
          token={token}
          isGuest={isGuest}
          guestName={guestName}
          onSignIn={onSignIn}
          onClose={() => setSelectedTherapist(null)}
        />
      )}

      {/* ── Developer Onboarding Wizard Modal ── */}
      {showDevOnboarding && (
        <TherapistOnboardingWizardModal
          onClose={() => setShowDevOnboarding(false)}
          onSuccess={() => {
            fetchTherapists(); // Refresh carousel with newly inserted database record
          }}
        />
      )}
    </section>
  );
}
