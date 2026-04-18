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
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
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
    },
  },
  plugins: [],
};

export default config;
