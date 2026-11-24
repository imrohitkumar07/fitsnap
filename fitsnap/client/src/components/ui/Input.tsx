/**
 * FitSnap - Input UI Component
 * Form input with glassmorphism border and focus ring.
 */

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-300 uppercase tracking-wider"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-2xl bg-white/[0.06] dark:bg-slate-900/40 border ${
              error ? 'border-red-500/60 focus:border-red-400' : 'border-white/15 focus:border-brand-500/80'
            } px-4 py-3 text-sm text-white placeholder-slate-400 backdrop-blur-md outline-none transition-all duration-200 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 text-slate-400 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-slate-400 mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
