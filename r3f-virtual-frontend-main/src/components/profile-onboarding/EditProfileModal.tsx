import { useCallback, useEffect, useState } from "react";
import { ModalShell } from "./ModalShell";
import { ProfileFormFields, type ProfileFormState } from "./ProfileFormFields";
import type { ProfileData } from "./constants";

export type EditProfileModalProps = {
  open: boolean;
  initialProfile: ProfileData;
  loading?: boolean;
  onClose: () => void;
  onSave: (profileData: ProfileData) => void;
};

export function EditProfileModal({
  open,
  initialProfile,
  loading = false,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [state, setState] = useState<ProfileFormState>({
    data: initialProfile,
    valid: true,
  });

  // Reset state when the modal opens.
  useEffect(() => {
    if (open) setState({ data: initialProfile, valid: true });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((s: ProfileFormState) => {
    setState((prev) => ({
      data: {
        ...prev.data,
        ...s.data,
      },
      valid: s.valid,
    }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.valid || loading) return;
    onSave(state.data);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy="edit-profile-title"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 id="edit-profile-title" className="text-lg font-semibold text-foreground">
            Edit profile
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-foreground">Full name</label>
            <input
              type="text"
              value={state.data.name ?? ""}
              onChange={(e) => setState((prev) => ({
                ...prev,
                data: { ...prev.data, name: e.target.value },
              }))}
              placeholder="Your full name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={state.data.email ?? ""}
              disabled
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-muted/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            />
            <label className="block text-sm font-medium text-foreground">Preferred language</label>
            <select
              value={state.data.languageCode ?? "en-IN"}
              onChange={(e) => setState((prev) => ({
                ...prev,
                data: { ...prev.data, languageCode: e.target.value },
              }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="en-IN">English (en-IN)</option>
              <option value="hi-IN">हिन्दी (hi-IN)</option>
              <option value="mr-IN">मराठी (mr-IN)</option>
            </select>
            <label className="block text-sm font-medium text-foreground">Why are you here?</label>
            <textarea
              value={state.data.reason ?? ""}
              onChange={(e) => setState((prev) => ({
                ...prev,
                data: { ...prev.data, reason: e.target.value },
              }))}
              placeholder="Tell us why you're here"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ProfileFormFields initial={state.data} onChange={handleChange} />
          <p className="mt-6 text-xs text-muted-foreground">
            Your profile details are used only to personalize your experience.
          </p>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!state.valid || loading}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
