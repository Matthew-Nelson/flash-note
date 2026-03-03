/**
 * FlashNote Tailwind Preset - Warm Wellness Theme
 *
 * Tailwind configuration for the Warm Wellness color scheme.
 * Uses emerald/teal/amber instead of cyan/violet/pink.
 *
 * Usage:
 *   presets: [require('./design-system/tailwind-preset-warm.js')]
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Brand colors - Warm Wellness palette
        brand: {
          // Primary - Emerald (healing/growth)
          emerald: {
            50: 'var(--fn-emerald-50)',
            100: 'var(--fn-emerald-100)',
            200: 'var(--fn-emerald-200)',
            300: 'var(--fn-emerald-300)',
            400: 'var(--fn-emerald-400)',
            500: 'var(--fn-emerald-500)',
            600: 'var(--fn-emerald-600)',
            700: 'var(--fn-emerald-700)',
            800: 'var(--fn-emerald-800)',
            900: 'var(--fn-emerald-900)',
          },
          // Secondary - Teal (clinical + modern)
          teal: {
            50: 'var(--fn-teal-50)',
            100: 'var(--fn-teal-100)',
            200: 'var(--fn-teal-200)',
            300: 'var(--fn-teal-300)',
            400: 'var(--fn-teal-400)',
            500: 'var(--fn-teal-500)',
            600: 'var(--fn-teal-600)',
            700: 'var(--fn-teal-700)',
            800: 'var(--fn-teal-800)',
            900: 'var(--fn-teal-900)',
          },
          // Accent - Amber (warm highlights)
          amber: {
            50: 'var(--fn-amber-50)',
            100: 'var(--fn-amber-100)',
            200: 'var(--fn-amber-200)',
            300: 'var(--fn-amber-300)',
            400: 'var(--fn-amber-400)',
            500: 'var(--fn-amber-500)',
            600: 'var(--fn-amber-600)',
            700: 'var(--fn-amber-700)',
            800: 'var(--fn-amber-800)',
            900: 'var(--fn-amber-900)',
          },
        },
        // Warm neutral - Stone
        stone: {
          50: 'var(--fn-stone-50)',
          100: 'var(--fn-stone-100)',
          200: 'var(--fn-stone-200)',
          300: 'var(--fn-stone-300)',
          400: 'var(--fn-stone-400)',
          500: 'var(--fn-stone-500)',
          600: 'var(--fn-stone-600)',
          700: 'var(--fn-stone-700)',
          800: 'var(--fn-stone-800)',
          900: 'var(--fn-stone-900)',
        },
        // Warm backgrounds - Cream
        cream: {
          50: 'var(--fn-cream-50)',
          100: 'var(--fn-cream-100)',
          200: 'var(--fn-cream-200)',
          300: 'var(--fn-cream-300)',
        },
        // Semantic colors using CSS custom properties
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
          info: {
            light: 'var(--fn-info-light)',
            DEFAULT: 'var(--fn-info)',
            dark: 'var(--fn-info-dark)',
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
        'fn-glow-lg': '0 0 30px var(--fn-accent-glow)',
        'fn-focus': 'var(--fn-focus-ring)',
      },
      animation: {
        'fn-pulse-glow': 'fn-pulse-glow 2s ease-in-out infinite',
        'fn-gradient-shift': 'fn-gradient-shift 8s ease infinite', // Slower!
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
        // Primary gradient - emerald to teal (2 colors, cleaner)
        'fn-gradient-primary': 'linear-gradient(135deg, var(--fn-accent-primary), var(--fn-accent-secondary))',
        // Warm gradient - emerald to amber
        'fn-gradient-warm': 'linear-gradient(135deg, var(--fn-accent-primary), var(--fn-accent-tertiary))',
        // Subtle gradient for backgrounds
        'fn-gradient-subtle': 'var(--fn-gradient-subtle)',
      },
    },
  },
};
