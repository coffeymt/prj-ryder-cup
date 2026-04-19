import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        'team-a': 'var(--color-team-a)',
        'team-b': 'var(--color-team-b)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-text': 'var(--color-accent-text)',
        'accent-soft': 'var(--color-accent-soft)',
        'accent-ring': 'var(--color-accent-ring)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'surface-glass': 'var(--color-surface-glass)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'status-up': 'var(--color-status-up)',
        'status-down': 'var(--color-status-down)',
        'status-halved': 'var(--color-status-halved)',
        'status-closed': 'var(--color-status-closed)',
        online: 'var(--color-online)',
        offline: 'var(--color-offline)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
        '4xl': 'var(--text-4xl)',
      },
      lineHeight: {
        tight: 'var(--leading-tight)',
        normal: 'var(--leading-normal)',
      },
      minHeight: {
        touch: 'var(--touch-target-min)',
        stepper: 'var(--stepper-min)',
      },
      minWidth: {
        touch: 'var(--touch-target-min)',
        stepper: 'var(--stepper-min)',
      },
      spacing: {
        'card-padding': 'var(--card-padding)',
        'nav-height': 'var(--nav-height)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(1rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-slow) var(--ease-standard) both',
        'slide-up-fade': 'slide-up-fade var(--duration-slow) var(--ease-standard) both',
        'pulse-soft': 'pulse-soft 2s var(--ease-standard) infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
