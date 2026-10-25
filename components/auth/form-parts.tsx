import type { ReactNode } from "react";

export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <section className="w-full max-w-md rounded-card bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{intro}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

export function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
  readOnly,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
  readOnly?: boolean;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="h-12 rounded-field border border-border-strong bg-surface px-4 text-base text-ink outline-none read-only:bg-canvas focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-12 rounded-field border border-border-strong bg-surface px-4 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm font-medium text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p role="alert" className="rounded-field bg-badge-amber-soft px-4 py-3 text-sm text-badge-amber">
      {message}
    </p>
  );
}

/** Moves focus to the first field (in form order) that has an error. */
export function focusFirstInvalid(fields: [id: string, error: string | undefined][]) {
  const first = fields.find(([, error]) => error !== undefined);
  if (first) document.getElementById(first[0])?.focus();
}

/**
 * `aria-disabled` rather than `disabled` while pending, so keyboard focus stays
 * on the button; the forms ignore submits while pending instead.
 */
export function SubmitButton({ pending, label, pendingLabel }: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      className="h-12 rounded-full bg-primary px-6 text-base font-medium text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-wait"
    >
      {/* The accessible name stays the label so the button is easy to find. */}
      <span aria-hidden={pending || undefined}>{pending ? pendingLabel : label}</span>
      {pending && <span className="sr-only">{label}</span>}
    </button>
  );
}
