/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: "#22d3ee",
          pink: "#f472b6",
          violet: "#8b5cf6"
        }
      },
      boxShadow: {
        neon: "0 0 24px rgba(34, 211, 238, 0.35)"
      }
    }
  },
  plugins: []
};
