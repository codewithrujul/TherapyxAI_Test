import { useState } from 'react';
import { API_BASE } from '../../config';
import { formatINR } from '../../lib/currency';

const POPULAR_SPECIALTIES = [
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

const POPULAR_LANGUAGES = ['English', 'Spanish', 'Hindi', 'Marathi', 'French', 'Mandarin'];

export default function TherapistOnboardingWizardModal({ onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedTherapist, setSavedTherapist] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Basic & Personal Info
    fullName: '',
    email: '',
    phone: '',
    title: 'Licensed Clinical Psychologist',
    yearsOfExperience: 5,
    addressCity: '',
    addressCountry: '',
    profilePictureUrl: '',

    // Step 2: Specialties & Bio
    shortHeadline: '',
    bio: '',
    specialties: ['Anxiety', 'CBT'],
    languages: ['English'],

    // Step 3: Rates & Preferences
    hourlyRate: 1500,
    currency: 'INR',
    supportedSessionTypes: ['video']
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSpecialty = (item) => {
    setFormData(prev => {
      const exists = prev.specialties.includes(item);
      return {
        ...prev,
        specialties: exists 
          ? prev.specialties.filter(s => s !== item)
          : [...prev.specialties, item]
      };
    });
  };

  const toggleLanguage = (item) => {
    setFormData(prev => {
      const exists = prev.languages.includes(item);
      return {
        ...prev,
        languages: exists 
          ? prev.languages.filter(l => l !== item)
          : [...prev.languages, item]
      };
    });
  };

  const toggleSessionType = (type) => {
    setFormData(prev => {
      const exists = prev.supportedSessionTypes.includes(type);
      if (exists && prev.supportedSessionTypes.length === 1) return prev;
      return {
        ...prev,
        supportedSessionTypes: exists 
          ? prev.supportedSessionTypes.filter(t => t !== type)
          : [...prev.supportedSessionTypes, type]
      };
    });
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (currentStep === 1) {
      if (!formData.fullName.trim() || !formData.email.trim() || !formData.title.trim()) {
        setErrorMsg('Please fill out all required fields (Full Name, Email, and Professional Title).');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmitOnboarding = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        ...formData,
        hourlyRate: Number(formData.hourlyRate) || 100,
        yearsOfExperience: Number(formData.yearsOfExperience) || 0,
        onboardingStep: 5,
        onboardingCompleted: true
      };

      const res = await fetch(`${API_BASE}/therapists/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to save therapist to database.');
      }

      setSavedTherapist(json.therapist);
      if (onSuccess) onSuccess(json.therapist);
    } catch (err) {
      console.error('[TherapistOnboarding] Error saving therapist:', err);
      setErrorMsg(err.message || 'An error occurred while connecting to the backend database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border/80 p-6 sm:p-8 shadow-2xl text-foreground">
        
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

        {/* Wizard Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Dev Mode Onboarding
            </span>
            <span className="text-xs text-muted-foreground">Direct Database Test</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Therapist Onboarding Wizard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fill out the steps below to insert a real therapist record into your Supabase database.
          </p>
        </div>

        {/* Progress Bar */}
        {!savedTherapist && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold mb-2 text-muted-foreground">
              <span className={currentStep >= 1 ? 'text-primary font-bold' : ''}>1. Basic Details</span>
              <span className={currentStep >= 2 ? 'text-primary font-bold' : ''}>2. Modalities & Bio</span>
              <span className={currentStep >= 3 ? 'text-primary font-bold' : ''}>3. Pricing & Save</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SUCCESS SCREEN */}
        {savedTherapist ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Therapist Profile Created!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Successfully saved <strong className="text-foreground">{savedTherapist.full_name}</strong> to the <code className="px-1.5 py-0.5 rounded bg-muted">public.therapists</code> table in Supabase.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 text-left text-xs space-y-1">
              <div><span className="text-muted-foreground">ID:</span> <code className="font-mono text-primary">{savedTherapist.id}</code></div>
              <div><span className="text-muted-foreground">Title:</span> {savedTherapist.title}</div>
              <div><span className="text-muted-foreground">Rate:</span> {formatINR(savedTherapist.hourly_rate)}/hr</div>
              <div><span className="text-muted-foreground">Status:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">{savedTherapist.status || 'Active'}</span></div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg"
                style={{ backgroundImage: 'var(--gradient-primary)' }}
              >
                View in Carousel
              </button>
            </div>
          </div>
        ) : (
          /* STEP FORMS */
          <form onSubmit={currentStep === 3 ? handleSubmitOnboarding : handleNextStep} className="space-y-4 text-xs sm:text-sm">
            
            {/* ── STEP 1: Basic Info ── */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Maya Lin"
                    value={formData.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="maya.lin@example.com"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 019-2834"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Professional Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Licensed Clinical Psychologist, LMFT, LCSW"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={formData.yearsOfExperience}
                      onChange={(e) => updateField('yearsOfExperience', e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      City / Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. New York, USA"
                      value={formData.addressCity}
                      onChange={(e) => updateField('addressCity', e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Profile Picture Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-1594824813566-8185d263914a..."
                    value={formData.profilePictureUrl}
                    onChange={(e) => updateField('profilePictureUrl', e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            )}

            {/* ── STEP 2: Modalities & Bio ── */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Short Headline (1 sentence summary)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CBT specialist helping clients overcome panic attacks and chronic stress"
                    value={formData.shortHeadline}
                    onChange={(e) => updateField('shortHeadline', e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Detailed Biography
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe therapeutic approach, background, and how you help clients..."
                    value={formData.bio}
                    onChange={(e) => updateField('bio', e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Specialties & Focus Areas
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SPECIALTIES.map(item => {
                      const selected = formData.specialties.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleSpecialty(item)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            selected 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                    Languages Spoken
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_LANGUAGES.map(lang => {
                      const selected = formData.languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            selected 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{lang}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Pricing & Session Preferences ── */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Session Cost / Rate (₹ INR) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        ₹
                      </span>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 1500"
                        value={formData.hourlyRate}
                        onChange={(e) => updateField('hourlyRate', e.target.value)}
                        className="w-full pl-7 pr-2.5 py-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Currency
                    </label>
                    {/* Prices are in Indian Rupees only */}
                    <div className="w-full p-2.5 text-xs rounded-xl border border-border/60 bg-muted/40 text-foreground font-semibold">
                      INR (₹) - Indian Rupee
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">
                    Supported Session Format
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'video', label: '📹 1-on-1 Video Consultation (Google Meet)' }
                    ].map(st => {
                      const selected = formData.supportedSessionTypes.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => toggleSessionType(st.id)}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                            selected 
                              ? 'border-primary bg-primary/10 text-primary font-bold' 
                              : 'border-border/60 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{st.label}</span>
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                            ✓ Required
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Therapy sessions are conducted via secure, end-to-end encrypted 1-on-1 Google Meet video calls.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                  ⚡ <strong>Developer Test Mode:</strong> Submitting will save this record directly into your Supabase database table (<code className="px-1 py-0.5 rounded bg-amber-500/20">public.therapists</code>) with <code className="px-1 py-0.5 rounded bg-amber-500/20">status = 'active'</code>.
                </div>
              </div>
            )}

            {/* Navigation & Submit Buttons */}
            <div className="pt-4 flex items-center justify-between border-t border-border/40">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-muted"
                >
                  ← Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-muted"
                >
                  Cancel
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg"
                  style={{ backgroundImage: 'var(--gradient-primary)' }}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 text-xs font-bold rounded-xl text-primary-foreground shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundImage: 'var(--gradient-primary)' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving to DB...</span>
                    </>
                  ) : (
                    <span>🚀 Save Therapist to Database</span>
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
