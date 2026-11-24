/**
 * FitSnap - GlassCard UI Component
 * Semi-transparent glassmorphic card with backdrop blur and soft depth.
 */

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'solid' | 'glow';
  animate?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'default',
  animate = true,
  ...props
}) => {
  const variantStyles = {
    default:
      'bg-white/[0.07] dark:bg-slate-900/40 backdrop-blur-xl border border-white/[0.12] dark:border-white/[0.08] shadow-glass',
    solid:
      'bg-slate-900/80 backdrop-blur-2xl border border-white/[0.1] shadow-glass-lg',
    glow:
      'bg-brand-500/10 backdrop-blur-xl border border-brand-500/30 shadow-glow',
  };

  if (!animate) {
    return (
      <div className={`rounded-3xl p-5 ${variantStyles[variant]} ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`rounded-3xl p-5 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
