import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: '#0b0e13',
          panel: '#12161d',
          sub: '#171c25',
          raise: '#1d2430',
          line: '#232b38',
          line2: '#2c3543',
        },
        txt: {
          DEFAULT: '#e7ebf3',
          dim: '#8b95a8',
          mute: '#5f6a7d',
        },
        brand: {
          DEFAULT: '#4d8dff',
          violet: '#7b5cff',
        },
        ok: '#35c58a',
        warn: '#f5a623',
        danger: '#ff5f6d',
      },
      opacity: {
        '2': '0.02',
        '3': '0.03',
        '4': '0.04',
        '6': '0.06',
        '7': '0.07',
        '8': '0.08',
        '9': '0.09',
        '12': '0.12',
        '14': '0.14',
        '16': '0.16',
        '18': '0.18',
        '22': '0.22',
        '24': '0.24',
        '28': '0.28',
        '32': '0.32',
        '35': '0.35',
        '38': '0.38',
        '42': '0.42',
        '45': '0.45',
        '55': '0.55',
        '65': '0.65',
        '78': '0.78',
        '85': '0.85',
        '88': '0.88',
        '92': '0.92',
      },
      borderRadius: {
        panel: '12px',
        card: '10px',
        btn: '9px',
      },
      fontSize: {
        body: ['13.5px', { lineHeight: '1.75' }],
        base2: ['14px', { lineHeight: '1.75' }],
      },
      boxShadow: {        glow: '0 0 0 1px rgba(77,141,255,.22), 0 8px 28px -12px rgba(77,141,255,.45)',
        pop: '0 18px 48px -18px rgba(0,0,0,.72)',
      },
      keyframes: {
        breathe: {
          '0%,100%': { opacity: '.35', transform: 'scale(.94)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(255,95,109,.45)' },
          '70%': { boxShadow: '0 0 0 12px rgba(255,95,109,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(255,95,109,0)' },
        },
      },
      animation: {
        breathe: 'breathe 1.6s ease-in-out infinite',
        fadeUp: 'fadeUp .28s ease-out both',
        sweep: 'sweep 1.8s ease-in-out infinite',
        pulseRing: 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
