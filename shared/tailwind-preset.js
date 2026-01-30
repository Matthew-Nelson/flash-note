/**
 * FlashNote Tailwind Preset
 *
 * Shared Tailwind configuration for consistency between web and extension.
 * Import this preset in both tailwind.config files.
 *
 * Usage:
 *   presets: [require('../shared/tailwind-preset.js')]
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Brand colors using CSS custom properties
        // This allows theme switching to work with Tailwind classes
        brand: {
          cyan: {
            50: 'var(--fn-cyan-50)',
            100: 'var(--fn-cyan-100)',
            200: 'var(--fn-cyan-200)',
            300: 'var(--fn-cyan-300)',
            400: 'var(--fn-cyan-400)',
            500: 'var(--fn-cyan-500)',
            600: 'var(--fn-cyan-600)',
            700: 'var(--fn-cyan-700)',
            800: 'var(--fn-cyan-800)',
            900: 'var(--fn-cyan-900)',
          },
          violet: {
            50: 'var(--fn-violet-50)',
            100: 'var(--fn-violet-100)',
            200: 'var(--fn-violet-200)',
            300: 'var(--fn-violet-300)',
            400: 'var(--fn-violet-400)',
            500: 'var(--fn-violet-500)',
            600: 'var(--fn-violet-600)',
            700: 'var(--fn-violet-700)',
            800: 'var(--fn-violet-800)',
            900: 'var(--fn-violet-900)',
          },
          pink: {
            50: 'var(--fn-pink-50)',
            100: 'var(--fn-pink-100)',
            200: 'var(--fn-pink-200)',
            300: 'var(--fn-pink-300)',
            400: 'var(--fn-pink-400)',
            500: 'var(--fn-pink-500)',
            600: 'var(--fn-pink-600)',
            700: 'var(--fn-pink-700)',
            800: 'var(--fn-pink-800)',
            900: 'var(--fn-pink-900)',
          },
        },
        // Semantic colors using CSS custom properties for theme switching
        fn: {
          bg: {
            primary: 'var(--fn-bg-primary)',
            secondary: 'var(--fn-bg-secondary)',
            tertiary: 'var(--fn-bg-tertiary)',
            inverse: 'var(--fn-bg-inverse)',
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
            secondary: 'var(--fn-accent-secondary)',
            tertiary: 'var(--fn-accent-tertiary)',
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
        },
      },
      fontFamily: {
        sans: ['var(--fn-font-sans)'],
        mono: ['var(--fn-font-mono)'],
      },
      fontSize: {
        'fn-xs': 'var(--fn-text-xs)',
        'fn-sm': 'var(--fn-text-sm)',
        'fn-base': 'var(--fn-text-base)',
        'fn-lg': 'var(--fn-text-lg)',
        'fn-xl': 'var(--fn-text-xl)',
        'fn-2xl': 'var(--fn-text-2xl)',
        'fn-3xl': 'var(--fn-text-3xl)',
        'fn-4xl': 'var(--fn-text-4xl)',
      },
      spacing: {
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
      },
      boxShadow: {
        'fn-sm': 'var(--fn-shadow-sm)',
        'fn-base': 'var(--fn-shadow-base)',
        'fn-md': 'var(--fn-shadow-md)',
        'fn-lg': 'var(--fn-shadow-lg)',
        'fn-xl': 'var(--fn-shadow-xl)',
        'fn-glow': '0 0 20px var(--fn-accent-glow)',
        'fn-glow-lg': '0 0 40px var(--fn-accent-glow)',
        'fn-focus': 'var(--fn-focus-ring)',
      },
      animation: {
        'fn-pulse-glow': 'fn-pulse-glow 2s ease-in-out infinite',
        'fn-gradient-shift': 'fn-gradient-shift 3s ease infinite',
        'fn-fade-in': 'fn-fade-in 0.3s ease-out',
        'fn-fade-in-up': 'fn-fade-in-up 0.3s ease-out',
        'fn-slide-in-right': 'fn-slide-in-right 0.3s ease-out',
        'fn-shimmer': 'fn-shimmer 2s linear infinite',
        'fn-spin': 'fn-spin 1s linear infinite',
        'fn-spin-slow': 'fn-spin 3s linear infinite',
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
      backgroundImage: {
        // Gradient utilities for brand styling
        'fn-gradient-primary': 'linear-gradient(135deg, var(--fn-accent-primary), var(--fn-accent-secondary))',
        'fn-gradient-full': 'linear-gradient(135deg, var(--fn-accent-primary), var(--fn-accent-secondary), var(--fn-accent-tertiary))',
        'fn-gradient-animated': 'linear-gradient(135deg, var(--fn-accent-primary) 0%, var(--fn-accent-secondary) 50%, var(--fn-accent-tertiary) 100%)',
      },
    },
  },
};
