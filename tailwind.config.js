/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      backdropBlur: { xs: '2px' },
      colors: {
        primary: '#5b5fef',
        'primary-hover': '#4a4edb',
      },
    },
  },
  plugins: [],
};