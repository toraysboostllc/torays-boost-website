import { theme as brand } from "./src/config/theme.config.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "torays-red": brand.colors.red,
        "torays-navy": brand.colors.navy,
        "torays-bg": brand.colors.dark.bg,
        "torays-surface": brand.colors.dark.surface,
        "torays-surface-alt": brand.colors.dark.surfaceAlt,
        "torays-line": brand.colors.dark.line,
        "torays-text": brand.colors.text.primary,
        "torays-text-secondary": brand.colors.text.secondary,
        "torays-text-muted": brand.colors.text.muted,
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        "glow-red": brand.glow.red,
        "glow-navy": brand.glow.navy,
      },
      backgroundImage: {
        "torays-gradient":
          "radial-gradient(circle at 20% 0%, rgba(51,59,160,0.25) 0%, rgba(10,14,23,0) 45%), radial-gradient(circle at 85% 15%, rgba(218,31,38,0.15) 0%, rgba(10,14,23,0) 40%)",
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: 0.6 },
          "50%": { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
