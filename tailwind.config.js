/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jic: {
          orange: {
            DEFAULT: '#F97316',
            deep: '#EA580C',
            soft: '#FFF0E5',
            pale: '#FFF7ED',
          },
          navy: '#14243A',
          blue: {
            DEFAULT: '#2563EB',
            bright: '#3B82F6',
            soft: '#EFF6FF',
            pale: '#F5F9FF',
          },
          green: {
            DEFAULT: '#16A34A',
            deep: '#15803D',
            soft: '#DCFCE7',
            pale: '#F0FDF4',
          },
          yellow: {
            DEFAULT: '#EAB308',
            bright: '#FACC15',
            soft: '#FEF9C3',
            pale: '#FFFDE7',
          },
          bg: '#F8FAFC',
          card: '#FFFFFF',
          text: {
            DEFAULT: '#172033',
            secondary: '#64748B',
          },
          border: '#E2E8F0',
          muted: '#F1F5F9',
          error: {
            DEFAULT: '#DC2626',
            bg: '#FEF2F2',
          },
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
