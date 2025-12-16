/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          800: '#1a365d',
          900: '#0f172a',
        }
      },
      zIndex: {
        'modal': 9999,
        'modal-high': 10000,
      }
    },
  },
  plugins: [],
}