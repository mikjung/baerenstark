import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        baerenstark: {
          bark: '#3D2B1F',
          wood: '#7B5E3C',
          cream: '#F5EBDD',
          sand: '#D9C2A2',
          forest: '#4A5D3A',
          accent: '#C8A064',
          leaf: '#4A7C59',
          charcoal: '#2C2C2C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Playfair Display"', 'Merriweather', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(60, 40, 20, 0.08)',
        card: '0 4px 18px rgba(60, 40, 20, 0.10)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
