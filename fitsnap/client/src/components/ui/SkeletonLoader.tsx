/**
 * FitSnap - Skeleton Loader UI Component
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'card' | 'circle' | 'text' | 'chart';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  count = 1,
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'circle':
        return 'w-12 h-12 rounded-full';
      case 'card':
        return 'w-full h-36 rounded-3xl';
      case 'chart':
        return 'w-full h-56 rounded-3xl';
      case 'text':
      default:
        return 'w-full h-4 rounded-xl';
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-white/[0.08] dark:bg-slate-800/60 backdrop-blur-md ${getVariantClass()} ${className}`}
        />
      ))}
    </>
  );
};

export default SkeletonLoader;
