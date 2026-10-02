import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';

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

export default function TherapistOnboardingPage({ onBack, onSuccess, token, onSignOut }) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedTherapist, setSavedTherapist] = useState(null);

  // Form State (Clean, no dummy test values)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    title: '',
    yearsOfExperience: '',
    addressCity: '',
    addressCountry: '',
    profilePictureUrl: '',

    shortHeadline: '',
    bio: '',
    specialties: [],
    languages: [],

    hourlyRate: '',
    currency: 'INR',
    supportedSessionTypes: ['video']
  });

  // Verify Access & Prefill Name & Email
  useEffect(() => {
    async function verifyAccess() {
      try {
        setCheckingAuth(true);
        const { data: { session } } = await supabase.auth.getSession();
        const activeTok = token || session?.access_token || localStorage.getItem('accessToken');

        if (!activeTok) {
          setIsAuthorized(false);
          setAuthErrorMsg('Authentication required to access therapist onboarding.');
          setCheckingAuth(false);
          return;
        }

        // 1. Fetch user profile to prefill Name and Email
        const profileRes = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${activeTok}` }
        });

        if (profileRes.ok) {
          const json = await profileRes.json();
          if (json.profile) {
            setFormData(prev => ({
              ...prev,
              fullName: json.profile.name || prev.fullName,
              email: json.profile.email || prev.email
            }));

            if (json.profile.role === 'therapist') {
              setIsAuthorized(false);
              setAuthErrorMsg('Your account is already registered as a verified therapist.');
              setCheckingAuth(false);
              return;
            }
          }
        }

        // 2. Check if user already has an active pending onboarding request
        const statusRes = await fetch(`${API_BASE}/therapist-onboarding/status`, {
          headers: { Authorization: `Bearer ${activeTok}` }
        });

        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          const requestStatus = statusJson.request?.status;
          if (requestStatus === 'pending') {
            setIsAuthorized(false);
            setAuthErrorMsg('Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request.');
            setCheckingAuth(false);
            return;
          }
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error('[TherapistOnboardingPage] Access verification error:', err);
        setIsAuthorized(false);
        setAuthErrorMsg('Failed to verify onboarding permissions.');
      } finally {
        setCheckingAuth(false);
      }
    }

    verifyAccess();
  }, [token]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSpecialty = (item) => {
    setFormData(prev => {
      const exists = prev.specialties.includes(item);
      return {
        ...prev,
        specialties: exists ? prev.specialties.filter(s => s !== item) : [...prev.specialties, item]
      };
    });
  };

  const toggleLanguage = (item) => {
    setFormData(prev => {
      const exists = prev.languages.includes(item);
      return {
        ...prev,
        languages: exists ? prev.languages.filter(l => l !== item) : [...prev.languages, item]
      };
    });
  };

  const toggleSessionType = (type) => {
    setFormData(prev => {
      const exists = prev.supportedSessionTypes.includes(type);
      if (exists && prev.supportedSessionTypes.length === 1) return prev;
      return {
        ...prev,
        supportedSessionTypes: exists ? prev.supportedSessionTypes.filter(t => t !== type) : [...prev.supportedSessionTypes, type]
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
      const { data: { session } } = await supabase.auth.getSession();
      const activeTok = token || session?.access_token || localStorage.getItem('accessToken');

      const payload = {
        ...formData,
        hourlyRate: Number(formData.hourlyRate) || 0,
        yearsOfExperience: Number(formData.yearsOfExperience) || 0,
      };

      const headers = { 'Content-Type': 'application/json' };
      if (activeTok) {
        headers['Authorization'] = `Bearer ${activeTok}`;
      }

      const res = await fetch(`${API_BASE}/therapist-onboarding/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to submit onboarding request.');
      }

      setSavedTherapist(json.request || true);
      if (onSuccess) onSuccess(json.request);
    } catch (err) {
      console.error('[TherapistOnboardingPage] Error submitting request:', err);
      setErrorMsg(err.message || 'An error occurred while submitting your request to administrator.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground animate-pulse">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading Therapist Onboarding...</span>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="max-w-md w-full rounded-3xl border border-purple-500/30 bg-card p-8 shadow-2xl text-center space-y-6 animate-fade-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 shadow-inner">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Therapist Onboarding Status</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {authErrorMsg || 'Your therapist onboarding request is currently pending administrator review. You will be notified when your application is approved.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-xs hover:bg-red-500/10 transition-all shadow-md active:scale-95"
              >
                Sign Out
              </button>
            )}
            <button
              onClick={onBack}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-all shadow-md active:scale-95"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* ── Header — shared across every internal page: back button + theme + profile ── */}
      <PageHeader onBack={onBack} />

      {/* ── Main Container ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-8 animate-fade-up">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Therapist Application
          </span>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Sign out of application"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Sign Out</span>
            </button>
          )}
        </div>
        <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-10 shadow-xl space-y-6">
          
          {/* Header */}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Therapist Onboarding Form</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Please complete your professional credentials below to submit your onboarding request to the administrator.
            </p>
          </div>

          {/* Stepper Bar */}
          {!savedTherapist && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2">
                <span className={currentStep >= 1 ? 'text-primary font-extrabold' : ''}>1. Basic Details</span>
                <span className={currentStep >= 2 ? 'text-primary font-extrabold' : ''}>2. Modalities & Bio</span>
                <span className={currentStep >= 3 ? 'text-primary font-extrabold' : ''}>3. Pricing & Submit</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {savedTherapist ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center shadow-inner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-foreground">Request Sent to Administrator</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your request to onboard as a therapist has been sent to the admin. You will be notified when the admin approves your request.
                </p>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  onClick={onBack}
                  className="px-6 py-3 text-xs font-bold rounded-2xl text-primary-foreground shadow-lg hover:shadow-xl"
                  style={{ backgroundImage: 'var(--gradient-primary)' }}
                >
                  ← Return to Home
                </button>
              </div>
            </div>
          ) : (
            /* STEP FORMS */
            <form onSubmit={currentStep === 3 ? handleSubmitOnboarding : handleNextStep} className="space-y-4 text-xs sm:text-sm">
              
              {/* STEP 1 */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Jane Doe"
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-primary/40 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="jane.doe@example.com"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
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
                        className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
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
                      className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
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
                        placeholder="e.g. 5"
                        value={formData.yearsOfExperience}
                        onChange={(e) => updateField('yearsOfExperience', e.target.value)}
                        className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                        City / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chicago, USA"
                        value={formData.addressCity}
                        onChange={(e) => updateField('addressCity', e.target.value)}
                        className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
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
                      className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Short Headline (1 sentence)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CBT specialist helping clients beat anxiety and professional burnout"
                      value={formData.shortHeadline}
                      onChange={(e) => updateField('shortHeadline', e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                      Detailed Biography
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe therapeutic philosophy, clinical experience, and approach..."
                      value={formData.bio}
                      onChange={(e) => updateField('bio', e.target.value)}
                      className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">
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
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              selected 
                                ? 'bg-primary text-primary-foreground shadow-sm' 
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
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">
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
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              selected 
                                ? 'bg-emerald-600 text-white shadow-sm' 
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

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                        Session Cost / Rate (₹ INR) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                          ₹
                        </span>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="e.g. 1500"
                          value={formData.hourlyRate}
                          onChange={(e) => updateField('hourlyRate', e.target.value)}
                          className="w-full pl-8 pr-3 py-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-muted-foreground uppercase tracking-wider">
                        Currency
                      </label>
                      {/* Prices are in Indian Rupees only */}
                      <div className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-muted/40 text-foreground font-semibold">
                        INR (₹) - Indian Rupee
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wider">
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
                            className={`py-3 px-4 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between ${
                              selected 
                                ? 'border-primary bg-primary/10 text-primary font-bold' 
                                : 'border-border/60 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{st.label}</span>
                            </span>
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              ✓ Required
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      All therapy sessions are hosted via secure, end-to-end encrypted 1-on-1 Google Meet video calls.
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-4 flex items-center justify-between border-t border-border/50">
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
                    onClick={onBack}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-muted"
                  >
                    Cancel
                  </button>
                )}

                {currentStep < 3 ? (
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold rounded-2xl text-primary-foreground shadow-md hover:shadow-lg"
                    style={{ backgroundImage: 'var(--gradient-primary)' }}
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 text-xs font-bold rounded-2xl text-primary-foreground shadow-lg hover:shadow-xl disabled:opacity-50"
                    style={{ backgroundImage: 'var(--gradient-primary)' }}
                  >
                    {loading ? 'Submitting Request...' : '🚀 Submit Request to Admin'}
                  </button>
                )}
              </div>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}
