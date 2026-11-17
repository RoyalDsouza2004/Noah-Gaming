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
        // Official NOAH GAMING Brand Palette
        noah: {
          charcoal: '#171014',     // Primary background
          darkBurgundy: '#260D17', // Secondary background
          burgundy: '#851B2B',     // Primary brand
          crimson: '#A51F35',      // Secondary brand
          lime: '#D7FF00',         // Highlight
          gold: '#F5B942',         // Secondary accent / Warning
          warmWhite: '#FFF4E8',    // Main text
          mutedRose: '#C7A5A8',    // Secondary text
          wine: '#49202C',         // Borders
          green: '#45C987',        // Success
          error: '#F06A76',        // Error
        },
        // Mapped gaming aliases for seamless compatibility
        gaming: {
          dark: '#171014',
          card: '#260D17',
          border: '#49202C',
          neon: '#D7FF00',
          purple: '#851B2B',
          green: '#45C987',
          accent: '#A51F35',
          amber: '#F5B942',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Orbitron', 'Rajdhani', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
