/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Linear / Stripe / Whoop health-tech token system
        brand: {
          50: '#eff4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b5fd',
          400: '#608efb',
          500: '#2F5BFF', // Single brand blue
          600: '#1d41e6',
          700: '#1730bf',
          800: '#18299b',
          900: '#19277b',
          950: '#10174a',
          DEFAULT: '#2F5BFF',
          accent: '#2F5BFF',
        },
        slate: {
          text: '#0F172A',
          secondary: '#475569',
          muted: '#94A3B8',
          subtle: '#CBD5E1',
          border: 'rgba(15, 23, 42, 0.08)',
          card: '#FFFFFF',
          bgLight: '#F7F8FA',
          bgDark: '#0B0D12',
        },
        accent: {
          success: '#16A34A',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          violet: '#8b5cf6',
          sky: '#0284c7',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          800: '#1e293b',
          850: '#151f32',
          900: '#0b1324',
          950: '#050914',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(15, 23, 42, 0.06)',
        lifted: '0 8px 24px rgba(15, 23, 42, 0.06)',
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
        glow: '0 0 24px -4px rgba(47, 91, 255, 0.25)',
        float: '0 20px 40px -15px rgba(15, 23, 42, 0.12)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        scan: 'scan 2.5s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateY(0%)', opacity: '0.8' },
          '50%': { transform: 'translateY(180%)', opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
