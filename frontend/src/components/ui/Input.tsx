'use client';

import React, { forwardRef, useState } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  /** Accessible labels for the show/hide-password toggle (password inputs only). */
  passwordToggleLabels?: { show: string; hide: string };
}

/**
 * Shared input. MUST forward the ref: react-hook-form's `register()` passes
 * one, and without it field values never reach the form state in production
 * builds — every submit fails validation with values missing.
 *
 * Password inputs get a built-in show/hide toggle.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    icon,
    id,
    className = '',
    type,
    passwordToggleLabels = { show: 'Show password', hide: 'Hide password' },
    ...inputProps
  },
  ref,
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-1 font-body">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink/80">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center text-ink/40">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
          className={[
            'w-full rounded-card border bg-white py-3 text-ink placeholder:text-ink/40',
            'transition-shadow duration-150',
            'focus:outline-none focus:ring-2 focus:ring-explore focus:ring-offset-1',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-ink/20',
            icon ? 'ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4' : 'px-4',
            isPassword ? 'ltr:pr-12 rtl:pl-12' : '',
            className,
          ].join(' ')}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            data-testid="toggle-password-visibility"
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={revealed ? passwordToggleLabels.hide : passwordToggleLabels.show}
            aria-pressed={revealed}
            /* The eye is 20px of drawing, which is not 44px of finger: the button around it is, centred on the icon
               so nothing moves. */
            className="absolute inset-y-0 ltr:right-1 rtl:left-1 flex w-11 items-center justify-center rounded text-ink/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore"
          >
            {revealed ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p
          id={inputId ? `${inputId}-error` : undefined}
          role="alert"
          className="text-xs text-red-500 ltr:pl-1 rtl:pr-1"
        >
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
