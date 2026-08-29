import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f4f1ff',
          100: '#ebe5ff',
          200: '#d9ccff',
          300: '#bea5ff',
          400: '#9b72ff',
          500: '#7c4dff',
          600: '#6d36ed',
          700: '#5c2ac7',
          800: '#4c259f',
          900: '#402181',
          950: '#261252',
        },
        workspace: {
          canvas: '#080b14',
          shell: '#0b0f1a',
          surface: '#101624',
          elevated: '#151c2d',
          hover: '#1a2235',
          border: '#222b3d',
          borderStrong: '#303b52',
          ink: '#f6f7fb',
          muted: '#9aa6ba',
          soft: '#667085',
          purple: '#7c4dff',
          blue: '#3b82f6',
          cyan: '#06b6d4',
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.22), 0 12px 30px rgba(0,0,0,.12)',
        pop: '0 24px 70px rgba(0,0,0,.42)',
        workspace: '0 18px 55px rgba(0,0,0,.22)',
      },
    },
  },
  plugins: [],
};
export default config;
