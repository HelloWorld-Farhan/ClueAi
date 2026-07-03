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
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 15px rgba(6,182,212,0.5))' },
          '50%': { opacity: 0.7, filter: 'drop-shadow(0 0 35px rgba(6,182,212,0.8))' },
        },
        'progress': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        }
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'progress': 'progress 2.5s ease-out forwards',
      }
    },
  },
  plugins: [],
}
