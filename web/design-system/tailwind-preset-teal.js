/**
 * FlashNote Tailwind Preset - Refined Teal Theme
 *
 * Maps all CSS custom properties from design-tokens-teal.css to Tailwind
 * utility class names. No backgroundImage key — gradients are removed
 * as a design direction (intentional omission).
 *
 * Usage:
 *   presets: [require('./design-system/tailwind-preset-teal.js')]
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        'fn-primary': {
          DEFAULT: 'var(--fn-primary)',
          hover: 'var(--fn-primary-hover)',
          light: 'var(--fn-primary-light)',
          50: 'var(--fn-primary-50)',
        },
        'fn-accent': {
          DEFAULT: 'var(--fn-accent)',
          light: 'var(--fn-accent-light)',
        },
        'fn-soap': {
          subjective: 'var(--fn-soap-subjective)',
          objective: 'var(--fn-soap-objective)',
          assessment: 'var(--fn-soap-assessment)',
          plan: 'var(--fn-soap-plan)',
        },
        'fn-sidebar': {
          bg: 'var(--fn-sidebar-bg)',
          text: 'var(--fn-sidebar-text)',
          'text-active': 'var(--fn-sidebar-text-active)',
          hover: 'rgba(255,255,255,0.08)',
          active: 'rgba(255,255,255,0.12)',
        },
        'fn-bg': {
          surface: 'var(--fn-bg-surface)',
          card: 'var(--fn-bg-card)',
          primary: 'var(--fn-bg-primary)',
          secondary: 'var(--fn-bg-secondary)',
          tertiary: 'var(--fn-bg-tertiary)',
          inverse: 'var(--fn-bg-inverse)',
        },
        'fn-text': {
          primary: 'var(--fn-text-primary)',
          secondary: 'var(--fn-text-secondary)',
          muted: 'var(--fn-text-muted)',
          inverse: 'var(--fn-text-inverse)',
        },
        'fn-border': {
          DEFAULT: 'var(--fn-border-color)',
          subtle: 'var(--fn-border-subtle)',
        },
        'fn-success': {
          DEFAULT: 'var(--fn-success)',
          light: 'var(--fn-success-light)',
          dark: 'var(--fn-success-dark)',
        },
        'fn-error': {
          DEFAULT: 'var(--fn-error)',
          light: 'var(--fn-error-light)',
          dark: 'var(--fn-error-dark)',
        },
        'fn-warning': {
          DEFAULT: 'var(--fn-warning)',
          light: 'var(--fn-warning-light)',
          dark: 'var(--fn-warning-dark)',
        },
        'fn-info': {
          DEFAULT: 'var(--fn-info)',
          light: 'var(--fn-info-light)',
          dark: 'var(--fn-info-dark)',
        },
        'fn-amber': {
          DEFAULT: 'var(--fn-amber)',
          light: 'var(--fn-amber-light)',
          dark: 'var(--fn-amber-dark)',
          50: 'var(--fn-amber-50)',
        },
        // Legacy fn.* alias block — preserves existing pages that use
        // bg-fn-bg-card, text-fn-text-primary, border-fn-border, etc.
        fn: {
          bg: {
            primary: 'var(--fn-bg-primary)',
            secondary: 'var(--fn-bg-secondary)',
            tertiary: 'var(--fn-bg-tertiary)',
            inverse: 'var(--fn-bg-inverse)',
            card: 'var(--fn-bg-card)',
          },
          text: {
            primary: 'var(--fn-text-primary)',
            secondary: 'var(--fn-text-secondary)',
            muted: 'var(--fn-text-muted)',
            inverse: 'var(--fn-text-inverse)',
          },
          border: {
            DEFAULT: 'var(--fn-border-color)',
            subtle: 'var(--fn-border-subtle)',
          },
          accent: {
            primary: 'var(--fn-accent-primary)',
            'primary-hover': 'var(--fn-accent-primary-hover)',
            secondary: 'var(--fn-accent-secondary)',
          },
          success: {
            light: 'var(--fn-success-light)',
            DEFAULT: 'var(--fn-success)',
            dark: 'var(--fn-success-dark)',
          },
          error: {
            light: 'var(--fn-error-light)',
            DEFAULT: 'var(--fn-error)',
            dark: 'var(--fn-error-dark)',
          },
          warning: {
            light: 'var(--fn-warning-light)',
            DEFAULT: 'var(--fn-warning)',
            dark: 'var(--fn-warning-dark)',
          },
          info: {
            light: 'var(--fn-info-light)',
            DEFAULT: 'var(--fn-info)',
            dark: 'var(--fn-info-dark)',
          },
          amber: {
            light: 'var(--fn-amber-light)',
            DEFAULT: 'var(--fn-amber)',
            dark: 'var(--fn-amber-dark)',
            50: 'var(--fn-amber-50)',
          },
        },
      },
      fontFamily: {
        sans: ['var(--fn-font-sans)'],
        mono: ['var(--fn-font-mono)'],
      },
      fontSize: {
        'fn-2xs': 'var(--fn-text-2xs)',
        'fn-xs': 'var(--fn-text-xs)',
        'fn-sm': 'var(--fn-text-sm)',
        'fn-base': 'var(--fn-text-base)',
        'fn-lg': 'var(--fn-text-lg)',
        'fn-xl': 'var(--fn-text-xl)',
        'fn-2xl': 'var(--fn-text-2xl)',
      },
      letterSpacing: {
        'fn-tight': 'var(--fn-tracking-tight)',
        'fn-normal': 'var(--fn-tracking-normal)',
        'fn-wide': 'var(--fn-tracking-wide)',
        'fn-wider': 'var(--fn-tracking-wider)',
      },
      spacing: {
        'fn-sidebar': 'var(--fn-sidebar-width)',
        'fn-context-panel': 'var(--fn-context-panel-width)',
        'fn-content-max': 'var(--fn-content-max-width)',
        'fn-1': 'var(--fn-space-1)',
        'fn-2': 'var(--fn-space-2)',
        'fn-3': 'var(--fn-space-3)',
        'fn-4': 'var(--fn-space-4)',
        'fn-5': 'var(--fn-space-5)',
        'fn-6': 'var(--fn-space-6)',
        'fn-8': 'var(--fn-space-8)',
        'fn-10': 'var(--fn-space-10)',
        'fn-12': 'var(--fn-space-12)',
        'fn-16': 'var(--fn-space-16)',
      },
      borderRadius: {
        'fn-sm': 'var(--fn-radius-sm)',
        'fn-base': 'var(--fn-radius-base)',
        'fn-md': 'var(--fn-radius-md)',
        'fn-lg': 'var(--fn-radius-lg)',
        'fn-xl': 'var(--fn-radius-xl)',
        'fn-badge': 'var(--fn-radius-badge)',
      },
      boxShadow: {
        'fn-sm': 'var(--fn-shadow-sm)',
        'fn-base': 'var(--fn-shadow-base)',
        'fn-md': 'var(--fn-shadow-md)',
        'fn-lg': 'var(--fn-shadow-lg)',
        'fn-xl': 'var(--fn-shadow-xl)',
        'fn-inset': 'var(--fn-shadow-inset)',
        'fn-focus': 'var(--fn-focus-ring)',
      },
      width: {
        'fn-sidebar': 'var(--fn-sidebar-width)',
        'fn-context-panel': 'var(--fn-context-panel-width)',
      },
      maxWidth: {
        'fn-content': 'var(--fn-content-max-width)',
      },
      animation: {
        'fn-fade-in': 'fn-fade-in 0.3s ease-out',
        'fn-fade-in-up': 'fn-fade-in-up 0.3s ease-out',
        'fn-slide-in-right': 'fn-slide-in-right 0.3s ease-out',
        'fn-shimmer': 'fn-shimmer 2s linear infinite',
        'fn-spin': 'fn-spin 1s linear infinite',
        'fn-breathe': 'fn-breathe 2s ease-in-out infinite',
        'fn-blink': 'fn-blink 1s step-end infinite',
      },
      transitionDuration: {
        'fn-fast': 'var(--fn-transition-fast)',
        'fn-base': 'var(--fn-transition-base)',
        'fn-slow': 'var(--fn-transition-slow)',
      },
      transitionTimingFunction: {
        'fn-default': 'var(--fn-ease-default)',
        'fn-in': 'var(--fn-ease-in)',
        'fn-out': 'var(--fn-ease-out)',
        'fn-in-out': 'var(--fn-ease-in-out)',
      },
    },
  },
};
