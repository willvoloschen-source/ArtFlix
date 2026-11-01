/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          500: '#b64c1e',
          600: '#9f3f15'
        },
        map: {
          orange: '#b64c1e',
          gold: '#F59E0B',
          dark: '#0B0F17',
          panel: '#111827',
          card: '#1E293B'
        }
      }
    },
  },
  plugins: [],
}
