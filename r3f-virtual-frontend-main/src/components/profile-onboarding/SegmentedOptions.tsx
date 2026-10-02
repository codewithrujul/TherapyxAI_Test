type Option = { value: string; label: string };

type Props = {
  legend: string;
  name: string;
  options: readonly Option[];
  value?: string;
  onChange: (value: string | undefined) => void;
};

export function SegmentedOptions({ legend, name, options, value, onChange }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              onClick={() => onChange(selected ? undefined : opt.value)}
              className={[
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
