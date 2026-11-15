import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, optional, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-bold text-ink-900">
        {label} {optional && <span className="font-normal text-ink-500">(opcional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-700">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-base font-medium text-berry-700">
          <span aria-hidden>⚠️</span>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'w-full min-h-13 rounded-xl border-2 bg-white px-4 py-3 text-lg text-ink-900 placeholder:text-ink-500 transition-shadow focus:outline-none focus:ring-4 focus:ring-aqua-400 disabled:bg-mist-100 disabled:text-ink-500';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, trailing, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = [hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} id={fieldId}>
      <div className="flex items-stretch gap-2">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${error ? 'border-berry-600' : 'border-night-900'} ${className}`}
          {...rest}
        />
        {trailing}
      </div>
    </FieldShell>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, optional, id, className = '', rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} id={fieldId}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? 'border-berry-600' : 'border-night-900'} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});
