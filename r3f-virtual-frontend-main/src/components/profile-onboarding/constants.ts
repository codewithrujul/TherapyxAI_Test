export const GENDER_OPTIONS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
  { value: "self-describe", label: "Self-describe" },
] as const;

export const PROFESSION_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "working-professional", label: "Working professional" },
  { value: "freelancer", label: "Freelancer" },
  { value: "homemaker", label: "Homemaker" },
  { value: "business-owner", label: "Business owner" },
  { value: "not-working", label: "Currently not working" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
  { value: "other", label: "Other" },
] as const;

export const AGE_GROUP_OPTIONS = [
  { value: "under-18", label: "Under 18" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55+", label: "55+" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export type ProfileData = {
  name?: string;
  email?: string;
  languageCode?: string;
  reason?: string;
  gender?: string;
  profession?: string;
  ageGroup?: string;
};

export const PROFILE_FIELD_LABELS: Record<keyof ProfileData, string> = {
  name: "Full name",
  email: "Email",
  languageCode: "Preferred language",
  reason: "Why you're here",
  gender: "Gender",
  profession: "Profession",
  ageGroup: "Age group",
};
