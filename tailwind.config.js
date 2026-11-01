/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        map: {
          orange: '#F97316',
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
