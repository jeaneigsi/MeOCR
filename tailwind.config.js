/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'scan': 'scan 2s ease-in-out infinite',
      },
      colors: {
        primary: '#D11E1D',
        secondary: '#FCF0D6',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};