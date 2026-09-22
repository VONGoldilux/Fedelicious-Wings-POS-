import type { Config } from "tailwindcss";

// Brand palette for Fedelicious Wings: a char-grill charcoal base with a
// habanero-orange accent and a mustard secondary — a wing-shack identity
// rather than a generic SaaS blue.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        char: {
          950: "#1A1512",
          900: "#241D18",
          800: "#332921",
          700: "#463830",
        },
        ember: {
          50: "#FFF3EC",
          100: "#FFE2D0",
          400: "#FF8A4C",
          500: "#F0662B", // primary accent
          600: "#D14E18",
          700: "#A83C11",
        },
        mustard: {
          400: "#E8B23D",
          500: "#D49B22",
        },
        cream: "#FBF4EA",
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "0.875rem",
      },
    },
  },
  plugins: [],
};
export default config;
