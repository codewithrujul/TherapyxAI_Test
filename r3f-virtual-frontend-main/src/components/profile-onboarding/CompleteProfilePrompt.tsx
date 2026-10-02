import { PROFILE_FIELD_LABELS, type ProfileData } from "./constants";

export type CompleteProfilePromptProps = {
  /**
   * Keys of profile fields that are still missing.
   * Accepts either ProfileData keys ("gender" | "profession" | "ageGroup")
   * or already-formatted labels ("Gender", "Profession", "Age group").
   */
  missingFields: string[];
  completionPercent?: number;
  onUpdateProfile: () => void;
  onDismiss?: () => void;
};

function labelFor(field: string): string {
  if (field in PROFILE_FIELD_LABELS) {
    return PROFILE_FIELD_LABELS[field as keyof ProfileData];
  }
  return field;
}

export function CompleteProfilePrompt({
  missingFields,
  completionPercent = 0,
  onUpdateProfile,
  onDismiss,
}: CompleteProfilePromptProps) {
  if (missingFields.length === 0) return null;

  return (
    <section
      role="region"
      aria-label="Complete your profile"
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Complete your profile</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {completionPercent}% complete
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add a few details to personalize your sessions.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              width="16"
              height="16"
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
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Missing fields">
        {missingFields.map((f) => (
          <li
            key={f}
            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {labelFor(f)}
          </li>
        ))}
      </ul>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completionPercent}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onUpdateProfile}
          className="inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Update profile
        </button>
      </div>
    </section>
  );
}
