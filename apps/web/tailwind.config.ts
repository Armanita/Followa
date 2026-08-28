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
          canvas: '#EEF1F6',
          surface: '#FFFFFF',
          muted: '#F1F4F8',
          border: '#D8DEE8',
          ink: '#0F172A',
          'ink-muted': '#64748B',
          shell: '#0B1220',
          'shell-border': '#1E293B',
          'shell-muted': '#94A3B8',
          'shell-hover': '#111C30',
          'shell-active': '#172554',
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
        workspace: '0 1px 2px rgba(15,23,42,.05), 0 10px 30px rgba(15,23,42,.06)',
        'workspace-pop': '0 24px 60px rgba(2,6,23,.28)',
      },
    },
  },
  plugins: [],
};
export default config;
