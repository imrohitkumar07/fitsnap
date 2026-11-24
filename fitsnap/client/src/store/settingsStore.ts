import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ────────────────────────────────────────────────────────

interface SettingsState {
  /** Whether to disable 3D effects for performance */
  reduce3D: boolean;
  /** Dark mode enabled (always true by default) */
  darkMode: boolean;
  /** Whether the browser supports WebGL */
  hasWebGL: boolean;
  /** Selected language (en = English, hi = Hindi) */
  language: 'en' | 'hi';
  /** Measurement unit system (metric vs imperial) */
  units: 'metric' | 'imperial';
}

interface SettingsActions {
  toggleReduce3D: () => void;
  toggleDarkMode: () => void;
  setWebGL: (supported: boolean) => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  setUnits: (units: 'metric' | 'imperial') => void;
}

type SettingsStore = SettingsState & SettingsActions;

/**
 * Check if user prefers reduced motion via OS/browser setting.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Store ────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      reduce3D: prefersReducedMotion(),
      darkMode: true,
      hasWebGL: true,
      language: 'en',
      units: 'metric',

      toggleReduce3D: () => set((state) => ({ reduce3D: !state.reduce3D })),

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      setWebGL: (supported) => set({ hasWebGL: supported }),

      setLanguage: (language) => set({ language }),

      setUnits: (units) => set({ units }),
    }),
    {
      name: 'fitsnap_settings',
      partialize: (state) => ({
        reduce3D: state.reduce3D,
        darkMode: state.darkMode,
        language: state.language,
        units: state.units,
      }),
    }
  )
);
