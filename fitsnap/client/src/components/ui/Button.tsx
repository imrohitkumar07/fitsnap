/**
 * FitSnap - Button UI Component
 * Tactile 3D-styled interactive button with spring animation.
 */

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-xl',
    md: 'px-5 py-2.5 text-sm font-semibold rounded-2xl',
    lg: 'px-6 py-3.5 text-base font-bold rounded-2xl',
  };

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white shadow-glow hover:shadow-glow-lg border border-brand-400/30',
    secondary:
      'bg-white/10 hover:bg-white/15 text-white border border-white/15 backdrop-blur-md',
    ghost:
      'bg-transparent hover:bg-white/5 text-slate-300 hover:text-white',
    danger:
      'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30',
    glow:
      'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white shadow-glow-lg border border-white/20',
  };

  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.96 }}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
};

export default Button;
