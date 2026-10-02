import { useCallback, useEffect, useState } from "react";
import { ModalShell } from "./ModalShell";
import { ProfileFormFields, type ProfileFormState } from "./ProfileFormFields";
import type { ProfileData } from "./constants";

export type OptionalProfileOnboardingProps = {
  open: boolean;
  initialProfile?: ProfileData;
  loading?: boolean;
  onSkip: () => void;
  onComplete: (profileData: ProfileData) => void;
};

export function OptionalProfileOnboarding({
  open,
  initialProfile,
  loading = false,
  onSkip,
  onComplete,
}: OptionalProfileOnboardingProps) {
  const [step, setStep] = useState<number>(1);
  const [formState, setFormState] = useState<ProfileFormState>({ data: initialProfile ?? {}, valid: true });

  const [languageCode, setLanguageCode] = useState<string>(initialProfile?.languageCode ?? "en-IN");
  const [reason, setReason] = useState<string>(initialProfile?.reason ?? "");

  useEffect(() => {
    if (open) {
      setStep(1);
      setFormState({ data: initialProfile ?? {}, valid: true });
      setLanguageCode(initialProfile?.languageCode ?? "en-IN");
      setReason(initialProfile?.reason ?? "");
    }
  }, [open, initialProfile]);

  const handleChange = useCallback((s: ProfileFormState) => {
    setFormState((prev) => ({
      data: {
        ...prev.data,
        ...s.data,
      },
      valid: s.valid,
    }));
  }, []);

  const goNext = () => setStep((s) => Math.min(3, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (step === 1) {
      // proceed to reason
      goNext();
      return;
    }

    if (step === 2) {
      // proceed to profile details
      goNext();
      return;
    }

    // final step: validate profile fields
    if (!formState.valid) return;

    const out: ProfileData = {
      ...formState.data,
      languageCode: languageCode || undefined,
      reason: reason?.trim() || undefined,
    };

    onComplete(out);
  };

  return (
    <ModalShell
      open={open}
      onClose={onSkip}
      labelledBy="onboarding-title"
      describedBy="onboarding-subtitle"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id="onboarding-title" className="text-lg font-semibold text-foreground">
              Tell us a little about you
            </h2>
            <p id="onboarding-subtitle" className="mt-1 text-sm text-muted-foreground">
              This helps personalize your sessions. You can skip this and update it later.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onSkip}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step indicator */}
          <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
            <span className={step === 1 ? 'text-foreground font-medium' : ''}>1. Language</span>
            <span>•</span>
            <span className={step === 2 ? 'text-foreground font-medium' : ''}>2. Why here</span>
            <span>•</span>
            <span className={step === 3 ? 'text-foreground font-medium' : ''}>3. About you</span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-foreground">Preferred language</label>
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="en-IN">English (en-IN)</option>
                <option value="hi-IN">हिन्दी (hi-IN)</option>
                <option value="mr-IN">मराठी (mr-IN)</option>
              </select>
              <p className="text-xs text-muted-foreground">Choose your preferred language for prompts and voice.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-foreground">Why are you using TherapyxAI?</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us briefly what brought you here (e.g., anxiety, sleep issues, stress)"
                maxLength={300}
                rows={4}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">This helps tailor the first session. Optional.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <ProfileFormFields initial={initialProfile} onChange={handleChange} />
              <p className="mt-6 text-xs text-muted-foreground">
                Your profile details are used only to personalize your experience.
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Skip for now
          </button>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back
              </button>
            )}

            <button
              type="submit"
              disabled={(step === 3 && !formState.valid) || loading}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loading ? "Saving…" : step === 3 ? "Save and continue" : "Next"}
            </button>
          </div>
        </footer>
      </form>
    </ModalShell>
  );
}
