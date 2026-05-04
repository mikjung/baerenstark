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
        // Top-level Iteration-2-Tokens (Kalender, Counter-Proposal-Badges).
        leaf: '#4A7C59',
        // amber bleibt der Default-Tailwind-Farbumfang, hier expliziter Akzent-Wert.
        'amber-accent': '#F59E0B',
        // IT10 — semantische Feedback-Tokens (siehe
        // `project/design/ux/design-system-iteration-10-additions.md` §1).
        feedback: {
          success: '#3F7A4D',
          'success-bg': '#E8F1EA',
          warning: '#C8801A',
          'warning-bg': '#FBF1E1',
          error: '#B23A3A',
          'error-bg': '#F7E4E4',
          info: '#3D6B8C',
          'info-bg': '#E4ECF3',
        },
        // IT10 — Status-Badge-Token „Abgeschlossen" (QA UX-2).
        status: {
          'completed-fg': '#5C4226',
          'completed-bg': '#EADBC0',
          'completed-border': '#A38660',
        },
        // IT13-D1 — OAuth-Provider-Brand-Colors (Facebook).
        // Siehe `project/design/ux/design-system-iteration-13-additions.md` §IT13-D1.
        oauth: {
          facebook: {
            DEFAULT: '#1877F2',
            hover: '#166FE5',
            active: '#0F5FCD',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Playfair Display"', 'Merriweather', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px rgba(60, 40, 20, 0.08)',
        card: '0 4px 18px rgba(60, 40, 20, 0.10)',
        // IT10 — Modal- und Toast-Shadow.
        modal: '0 24px 48px rgba(60, 40, 20, 0.18)',
        toast: '0 10px 24px rgba(60, 40, 20, 0.14)',
      },
      borderRadius: {
        xl2: '1.25rem',
        // IT10 — Modal-Radius (Bottom-Sheet-Top + Desktop-Modal).
        modal: '1rem',
      },
      zIndex: {
        'modal-backdrop': '40',
        'modal-content': '50',
        toast: '60',
      },
      keyframes: {
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'toast-in': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-in': 'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
