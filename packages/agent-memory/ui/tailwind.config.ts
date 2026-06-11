import type { Config } from 'tailwindcss';

export default {
  // Globs resolve from the CWD where the build runs (the package root, via
  // `vite build --config ui/vite.config.ts`), so they must be ui-prefixed —
  // otherwise Tailwind scans the backend src/ and purges every UI utility.
  content: ['./ui/index.html', './ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0c0e',
        panel: '#121417',
        'panel-2': '#16191d',
        line: '#23272e',
        ink: '#e6e8ea',
        'ink-dim': '#8b9099',
        'ink-faint': '#565b63',
        amber: '#ff7a18',
        cyan: '#3fd0c9',
        danger: '#ff3b3b',
        warn: '#ffc23b',
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: 'inset 0 1px 0 0 rgba(255,255,255,0.03), 0 1px 2px 0 rgba(0,0,0,0.4)',
        glow: '0 0 0 1px rgba(255,122,24,0.5), 0 0 16px -2px rgba(255,122,24,0.35)',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-signal': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-signal': 'pulse-signal 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
