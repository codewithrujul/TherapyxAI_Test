import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { formatINR } from '../lib/currency';

export default function TherapistProfilePage({ therapist, onBook, onBack }) {
  const [selectedTab, setSelectedTab] = useState('about');

  if (!therapist) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">No therapist selected.</p>
        <button
          onClick={onBack}
          className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* ── Header — shared across every internal page: back button + theme + profile ── */}
      <PageHeader onBack={onBack} backLabel="Back to Home" />

      {/* ── Main Content Container ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-8 animate-fade-up">

        {/* Page context + quick book — used to live in the header */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">Therapist Profile</p>
          <button
            onClick={() => onBook(therapist)}
            className="px-4 py-2 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            style={{ backgroundImage: 'var(--gradient-primary)' }}
          >
            Book Appointment ({formatINR(therapist.hourly_rate)})
          </button>
        </div>

        {/* Hero Card */}
        <div className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-md p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative shrink-0">
            <img
              src={therapist.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
              alt={therapist.full_name}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover ring-4 ring-primary/20 shadow-md"
            />
            {therapist.is_verified && (
              <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1.5 shadow-md" title="Verified Professional">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Verified Clinical Professional
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {therapist.years_of_experience || 5}+ Years Experience
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
              {therapist.full_name}
            </h1>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {therapist.title}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
              {therapist.short_headline || therapist.bio}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-medium">
              <div className="flex items-center gap-1 text-primary font-bold">
                <span>🎓 {therapist.years_of_experience || therapist.experience_years || 5}+ years experience</span>
              </div>
              <div className="text-foreground font-bold">
                {formatINR(therapist.hourly_rate)} <span className="text-muted-foreground font-normal">/ 50-min session</span>
              </div>
              <div className="text-muted-foreground">
                Languages: <span className="text-foreground font-semibold">{therapist.languages?.join(', ') || 'English'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/60 gap-4 text-xs font-bold">
          <button
            onClick={() => setSelectedTab('about')}
            className={`pb-2.5 border-b-2 transition-all ${
              selectedTab === 'about'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview & Specialties
          </button>
          <button
            onClick={() => setSelectedTab('schedule')}
            className={`pb-2.5 border-b-2 transition-all ${
              selectedTab === 'schedule'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Working Schedule & Availability
          </button>
          {/* Client Reviews tab commented out for now */}
          {/* <button
            onClick={() => setSelectedTab('reviews')}
            className={`pb-2.5 border-b-2 transition-all ${
              selectedTab === 'reviews'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Client Reviews ({therapist.total_reviews || 12})
          </button> */}
        </div>

        {/* ── TAB 1: About & Specialties ── */}
        {selectedTab === 'about' && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About {therapist.full_name}</h3>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                {therapist.bio || 'Dr. ' + therapist.full_name + ' is a dedicated mental health clinician committed to offering compassionate, evidence-based psychological treatment. With years of clinical practice, sessions focus on emotional healing, self-awareness, and developing practical coping tools.'}
              </p>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Specialties & Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {(therapist.specialties || ['Anxiety', 'Depression', 'CBT', 'Stress', 'Mindfulness']).map((spec, i) => (
                  <span
                    key={i}
                    className="px-3.5 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl border border-border/60 bg-card">
                <span className="block text-xs font-semibold text-muted-foreground uppercase">Clinical Experience</span>
                <span className="text-sm font-bold text-foreground mt-1 block">
                  {therapist.years_of_experience || therapist.experience_years || 5}+ Years Practice
                </span>
              </div>
              <div className="p-5 rounded-3xl border border-border/60 bg-card">
                <span className="block text-xs font-semibold text-muted-foreground uppercase">Session Rate</span>
                <span className="text-sm font-bold text-foreground mt-1 block">
                  {formatINR(therapist.hourly_rate)} / session
                </span>
              </div>
              <div className="p-5 rounded-3xl border border-border/60 bg-card">
                <span className="block text-xs font-semibold text-muted-foreground uppercase">Timezone</span>
                <span className="text-sm font-bold text-foreground mt-1 block">
                  {therapist.timezone || 'UTC (Auto-sync)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Schedule ── */}
        {selectedTab === 'schedule' && (
          <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Weekly Consultation Hours</h3>
            <div className="divide-y divide-border/40 text-xs sm:text-sm">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <div key={day} className="py-3 flex items-center justify-between">
                  <span className="font-semibold text-foreground">{day}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">09:00 AM - 05:00 PM</span>
                </div>
              ))}
              {['Saturday', 'Sunday'].map((day) => (
                <div key={day} className="py-3 flex items-center justify-between text-muted-foreground">
                  <span>{day}</span>
                  <span className="text-xs">Off / By Special Request</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: Reviews (Commented out for now) ── */}
        {/* {selectedTab === 'reviews' && (
          <div className="space-y-4 animate-fade-in">
            {[
              { name: 'Sarah M.', rating: 5, date: '2 days ago', text: 'Extremely thoughtful listener. Helped me navigate panic attacks with actionable CBT exercises.' },
              { name: 'David R.', rating: 5, date: '1 week ago', text: 'Direct, empathetic, and professional. Made me feel safe and validated from minute one.' },
              { name: 'Anonymous', rating: 4.8, date: '3 weeks ago', text: 'Great session. Looking forward to continuing our weekly sessions.' }
            ].map((rev, i) => (
              <div key={i} className="p-5 rounded-3xl border border-border/60 bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{rev.name}</span>
                  <span className="text-amber-500 font-bold">★ {rev.rating}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">"{rev.text}"</p>
                <span className="text-[11px] text-muted-foreground/70 block">{rev.date}</span>
              </div>
            ))}
          </div>
        )} */}

        {/* Bottom CTA Banner */}
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Ready to book a session?</h4>
            <p className="text-xs text-slate-600">Choose a time slot for a 1-on-1 session with {therapist.full_name}.</p>
          </div>
          <button
            onClick={() => onBook(therapist)}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs"
          >
            Book session
          </button>
        </div>

      </main>
    </div>
  );
}
