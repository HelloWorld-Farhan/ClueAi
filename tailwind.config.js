/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0D1117',
          secondary: '#161B22',
          card: '#21262D',
          accent: '#58A6FF',
          accentSec: '#1F6FEB',
          hover: '#388BFD',
          border: '#30363D',
          text: '#F0F6FC',
          subtext: '#8B949E',
        }
      }
    },
  },
  plugins: [],
}
