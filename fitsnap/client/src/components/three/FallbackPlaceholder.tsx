/**
 * FallbackPlaceholder.tsx
 *
 * 2D fallback component rendered when WebGL is unavailable or the user
 * has opted into reduced-3D mode.  Uses a glassmorphism card with a
 * pulsing icon that matches the scene context.
 *
 * @module FallbackPlaceholder
 */

import React from 'react';
import { motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** The kind of 3D content this placeholder stands in for. */
export type IconType = 'chart' | 'water' | 'workout' | 'food' | 'general';

export interface FallbackPlaceholderProps {
  /** Contextual icon to display. @default 'general' */
  iconType?: IconType;
  /** Optional custom height matching the 3D canvas it replaces. */
  height?: string;
  /** Optional additional CSS classes. */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Icon map                                                           */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<IconType, string> = {
  chart: '📊',
  water: '💧',
  workout: '🏋️',
  food: '🍎',
  general: '🌐',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * A glassmorphism card shown in place of a 3D scene.
 *
 * It displays a contextual emoji icon with a gentle floating CSS
 * animation and a small "3D view unavailable" label at the bottom.
 */
const FallbackPlaceholder: React.FC<FallbackPlaceholderProps> = ({
  iconType = 'general',
  height = '300px',
  className = '',
}) => {
  return (
    <div
      className={`
        relative flex flex-col items-center justify-center overflow-hidden rounded-2xl
        bg-white/10 dark:bg-gray-900/30
        backdrop-blur-xl border border-white/20 dark:border-white/10
        shadow-lg
        ${className}
      `}
      style={{ height }}
    >
      {/* Gradient background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-brand-400/10 pointer-events-none" />

      {/* Pulsing / floating icon */}
      <motion.span
        className="text-5xl select-none"
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        aria-hidden
      >
        {ICON_MAP[iconType]}
      </motion.span>

      {/* Unavailable label */}
      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 select-none">
        3D view unavailable
      </p>
    </div>
  );
};

export default FallbackPlaceholder;
