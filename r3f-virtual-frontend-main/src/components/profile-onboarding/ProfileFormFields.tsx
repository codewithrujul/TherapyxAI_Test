import { useEffect, useState } from "react";
import { SegmentedOptions } from "./SegmentedOptions";
import {
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  PROFESSION_OPTIONS,
  type ProfileData,
} from "./constants";

export type ProfileFormState = {
  data: ProfileData;
  valid: boolean;
};

type Props = {
  initial?: ProfileData;
  onChange: (state: ProfileFormState) => void;
};

/**
 * Internal shared form. Tracks values for the three optional fields
 * plus the custom text inputs for "Self-describe" / "Other".
 *
 * Exposes a derived `valid` flag: only invalid when a custom option
 * is picked but its text input is blank.
 */
export function ProfileFormFields({ initial, onChange }: Props) {
  // Detect whether initial gender/profession should map to a custom text value.
  const initialGenderIsPreset = GENDER_OPTIONS.some((o) => o.value === initial?.gender);
  const initialProfessionIsPreset = PROFESSION_OPTIONS.some(
    (o) => o.value === initial?.profession,
  );

  const [gender, setGender] = useState<string | undefined>(
    initial?.gender && !initialGenderIsPreset ? "self-describe" : initial?.gender,
  );
  const [genderCustom, setGenderCustom] = useState<string>(
    initial?.gender && !initialGenderIsPreset ? initial.gender : "",
  );

  const [profession, setProfession] = useState<string | undefined>(
    initial?.profession && !initialProfessionIsPreset ? "other" : initial?.profession,
  );
  const [professionCustom, setProfessionCustom] = useState<string>(
    initial?.profession && !initialProfessionIsPreset ? initial.profession : "",
  );

  const [ageGroup, setAgeGroup] = useState<string | undefined>(initial?.ageGroup);

  useEffect(() => {
    setGender(initial?.gender && !initialGenderIsPreset ? "self-describe" : initial?.gender);
    setGenderCustom(initial?.gender && !initialGenderIsPreset ? initial.gender : "");
    setProfession(initial?.profession && !initialProfessionIsPreset ? "other" : initial?.profession);
    setProfessionCustom(initial?.profession && !initialProfessionIsPreset ? initial.profession : "");
    setAgeGroup(initial?.ageGroup);
  }, [initial, initialGenderIsPreset, initialProfessionIsPreset]);

  useEffect(() => {
    const needsGenderText = gender === "self-describe";
    const needsProfessionText = profession === "other";

    const genderInvalid = needsGenderText && genderCustom.trim().length === 0;
    const professionInvalid = needsProfessionText && professionCustom.trim().length === 0;

    const data: ProfileData = {};

    if (gender) {
      data.gender = needsGenderText ? genderCustom.trim() || undefined : gender;
    }

    if (profession) {
      data.profession = needsProfessionText
        ? professionCustom.trim() || undefined
        : profession;
    }

    if (ageGroup) {
      data.ageGroup = ageGroup;
    }

    onChange({ data, valid: !genderInvalid && !professionInvalid });
  }, [gender, genderCustom, profession, professionCustom, ageGroup, onChange]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SegmentedOptions
          legend="Gender"
          name="gender"
          options={GENDER_OPTIONS}
          value={gender}
          onChange={setGender}
        />
        {gender === "self-describe" && (
          <input
            type="text"
            aria-label="Self-describe gender"
            placeholder="How do you describe yourself?"
            value={genderCustom}
            onChange={(e) => setGenderCustom(e.target.value)}
            maxLength={60}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      <div className="space-y-2">
        <SegmentedOptions
          legend="Profession"
          name="profession"
          options={PROFESSION_OPTIONS}
          value={profession}
          onChange={setProfession}
        />
        {profession === "other" && (
          <input
            type="text"
            aria-label="Other profession"
            placeholder="Tell us your profession"
            value={professionCustom}
            onChange={(e) => setProfessionCustom(e.target.value)}
            maxLength={60}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      <SegmentedOptions
        legend="Age group"
        name="ageGroup"
        options={AGE_GROUP_OPTIONS}
        value={ageGroup}
        onChange={setAgeGroup}
      />
    </div>
  );
}
