import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [require('./design-system/tailwind-preset-warm.js')],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Web-specific overrides can go here
      // The base design system comes from the shared preset
    },
  },
  plugins: [],
};

export default config;
