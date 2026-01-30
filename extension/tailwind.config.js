/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('../shared/tailwind-preset.js')],
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      // Extension-specific overrides can go here
      // The base design system comes from the shared preset
    },
  },
  plugins: [],
};
