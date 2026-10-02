import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';
import PageHeader from '../components/PageHeader';
import { formatINR } from '../lib/currency';

const SPECIALTIES_LIST = [
  'All',
  'Anxiety',
  'Depression',
  'CBT',
  'Trauma/PTSD',
  'Couples Therapy',
  'Stress',
  'Burnout',
  'ADHD',
  'Grief',
  'Relationships'
];

export default function TherapistListPage({ onBack, onOpenProfile, onBook }) {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTherapists = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ limit: '50' });
      if (selectedSpecialty !== 'All') {
        query.append('specialty', selectedSpecialty);
      }
      if (searchQuery.trim()) {
        query.append('search', searchQuery.trim());
      }

      const res = await fetch(`${API_BASE}/therapists?${query}`);
      if (res.ok) {
        const json = await res.json();
        setTherapists(json.therapists || []);
      } else {
        setTherapists([]);
      }
    } catch (err) {
      console.error('[TherapistListPage] Fetch error:', err);
      setTherapists([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSpecialty, searchQuery]);

  useEffect(() => {
    fetchTherapists();
  }, [fetchTherapists]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/60 px-4 sm:px-8 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span>Back to home</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✓ Verified practitioners
          </span>
        </div>
      </header>

      {/* ── Main Discovery Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Title & Headline */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-slate-900">
            Choose a practitioner
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Connect with licensed practitioners for 1-on-1 sessions.
          </p>
        </div>

        {/* Search & Specialty Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          {/* Specialty Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {SPECIALTIES_LIST.map((spec) => (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedSpecialty === spec
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px] sm:w-72">
            <input
              type="text"
              placeholder="Search by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-normal"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
        </div>

        {/* Therapist Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 rounded-xl border border-slate-200 bg-white p-6 animate-pulse space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-12 bg-slate-100 rounded-lg" />
                <div className="h-8 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : therapists.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-slate-300 bg-white text-slate-600 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">No practitioners found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria.
            </p>
            <button
              onClick={() => { setSelectedSpecialty('All'); setSearchQuery(''); }}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-all shadow-xs"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {therapists.map(therapist => (
              <div
                key={therapist.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Photo & Badges */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="relative">
                      <img
                        src={therapist.profile_picture_url || 'https://images.unsplash.com/photo-1594824813566-8185d263914a?w=400&auto=format&fit=crop&q=80'}
                        alt={therapist.full_name}
                        className="w-14 h-14 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                      {therapist.is_verified && (
                        <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 shadow-xs" title="Verified Practitioner">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Experience & Rate */}
                    <div className="text-right">
                      <div className="text-xs text-slate-500 font-medium">
                        {therapist.years_of_experience || therapist.experience_years || 5}+ yrs experience
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatINR(therapist.hourly_rate)} <span className="text-xs font-normal text-slate-500">/ session</span>
                      </div>
                    </div>
                  </div>

                  {/* Name & Title */}
                  <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                    {therapist.full_name}
                  </h3>
                  <p className="text-xs font-medium text-emerald-700 mb-2">
                    {therapist.title} {therapist.years_of_experience ? `· ${therapist.years_of_experience} yrs exp` : ''}
                  </p>

                  {/* Headline / Bio */}
                  <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                    {therapist.short_headline || therapist.bio || 'Clinical psychologist providing online therapy.'}
                  </p>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {(therapist.specialties || ['Therapy', 'Mental Health']).slice(0, 3).map((spec, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700"
                      >
                        {spec}
                      </span>
                    ))}
                    {(therapist.specialties?.length || 0) > 3 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
                        +{(therapist.specialties.length - 3)}
                      </span>
                    )}
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(therapist)}
                    className="flex-1 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                  >
                    View profile
                  </button>
                  <button
                    type="button"
                    onClick={() => onBook(therapist)}
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
          </div>
        )}
      </main>
    </div>
  );
}
