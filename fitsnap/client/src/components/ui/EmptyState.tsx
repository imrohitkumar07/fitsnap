/**
 * FitSnap - EmptyState and ErrorState UI Components
 */

import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-white/[0.04] border border-white/10 ${className}`}>
      {icon && <div className="mb-4 text-brand-400 p-4 rounded-full bg-brand-500/10 border border-brand-500/20">{icon}</div>}
      <h4 className="text-base font-semibold text-white mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-xs mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 rounded-3xl bg-red-500/10 border border-red-500/20 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 mb-3">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-xs text-red-300 mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};
