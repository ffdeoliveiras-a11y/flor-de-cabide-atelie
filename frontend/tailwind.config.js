/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          brown: "#6B3F2A",     // Marrom principal
          brownDark: "#4E2D1E", // Hover do marrom
          pink: "#E8B4BC",      // Rosa suave
          pinkDark: "#C4838A",  // Rosa para links
          cream: "#F5F0EB",     // Creme / fundo
          text: "#3D2B1F",      // Texto principal
          offwhite: "#FDFAF7",  // Off-white (cards)
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(107, 63, 42, 0.18)",
      },
    },
  },
  plugins: [],
};
