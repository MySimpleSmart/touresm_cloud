/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef233c',
          600: '#dc1e35',
          700: '#c41a2e',
          800: '#ac1627',
          900: '#941220',
        },
      },
    },
  },
  plugins: [],
}

