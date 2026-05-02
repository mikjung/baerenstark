import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldShell({ label, hint, error, required, htmlFor, children }: FieldShellProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-baerenstark-bark">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-baerenstark-wood">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-baerenstark-bark/70">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, required, className = '', ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={[
          'w-full rounded-lg border bg-white/90 px-3 py-2 text-baerenstark-bark',
          'placeholder:text-baerenstark-bark/40',
          'focus:border-baerenstark-wood focus:outline-none focus:ring-2 focus:ring-baerenstark-accent',
          error
            ? 'border-red-500 focus:border-red-600'
            : 'border-baerenstark-sand',
          className,
        ].join(' ')}
        {...rest}
      />
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, required, className = '', rows = 4, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={[
          'w-full rounded-lg border bg-white/90 px-3 py-2 text-baerenstark-bark',
          'placeholder:text-baerenstark-bark/40',
          'focus:border-baerenstark-wood focus:outline-none focus:ring-2 focus:ring-baerenstark-accent',
          error
            ? 'border-red-500 focus:border-red-600'
            : 'border-baerenstark-sand',
          className,
        ].join(' ')}
        {...rest}
      />
    </FieldShell>
  );
});

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, id, required, options, placeholder, className = '', ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={[
          'w-full rounded-lg border bg-white/90 px-3 py-2 text-baerenstark-bark',
          'focus:border-baerenstark-wood focus:outline-none focus:ring-2 focus:ring-baerenstark-accent',
          error
            ? 'border-red-500 focus:border-red-600'
            : 'border-baerenstark-sand',
          className,
        ].join(' ')}
        {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});
