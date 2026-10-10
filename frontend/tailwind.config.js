/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        card: '#111827',
        border: '#1f293d',
        persona: {
          aarav: '#f43f5e',
          meera: '#06b6d4',
          rohan: '#8b5cf6',
          priya: '#ec4899',
          vikram: '#f59e0b',
          moderator: '#94a3b8',
          student: '#3b82f6',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'wave-bar': 'waveBar 1s ease-in-out infinite alternate',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.98)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        waveBar: {
          '0%': { height: '15%' },
          '100%': { height: '95%' },
        }
      }
    },
  },
  plugins: [],
}
