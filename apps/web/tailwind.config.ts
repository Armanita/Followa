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
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#6090fa',
          500: '#3b76f6',
          600: '#2558eb',
          700: '#1d43d8',
          800: '#1e39af',
          900: '#1e358a',
          950: '#172354',
        },
        workspace: {
          canvas: '#F6F7FB',
          surface: '#FFFFFF',
          muted: '#F1F4F8',
          border: '#E2E7EF',
          ink: '#0F172A',
          'ink-muted': '#64748B',
        },
        op: {
          brand: '#1E3A8A',
          'brand-soft': '#E8EEFF',
          danger: '#B91C1C',
          'danger-soft': '#FEF2F2',
          warning: '#B45309',
          'warning-soft': '#FFFBEB',
          success: '#047857',
          'success-soft': '#ECFDF5',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        pop: '0 8px 24px rgba(16,24,40,.12)',
        workspace: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04)',
        'workspace-pop': '0 20px 48px rgba(15,23,42,.16)',
      },
    },
  },
  plugins: [],
};
export default config;
