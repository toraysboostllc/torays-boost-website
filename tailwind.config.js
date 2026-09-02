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
        "torays-bg": brand.colors.neutral.bg,
        "torays-surface": brand.colors.neutral.surface,
        "torays-surface-alt": brand.colors.neutral.surfaceAlt,
        "torays-line": brand.colors.neutral.line,
        "torays-text": brand.colors.text.primary,
        "torays-text-secondary": brand.colors.text.secondary,
        "torays-text-muted": brand.colors.text.muted,
        // Quote-wizard palette. Every value that ever carries white text was
        // picked from a computed WCAG ratio, not by eye — see
        // repairRequestWizard.test.js, which recomputes them on every run.
        // The bright teal is deliberately NOT a button fill: it is 3.07:1 on
        // white, fine for borders/icons/selected states, far short of 4.5:1
        // for text.
        "quote-accent": "#0B7285", // 5.59:1 on white — solid buttons
        "quote-accent-hover": "#095E6E", // darker still
        "quote-accent-soft": "#12A594", // borders, icons, selected outline
        "quote-ink": "#075162", // text on the pale wash (7.69:1)
        "quote-wash": "#E4F1F3",
        "quote-line": "#D6E4E7",
        "quote-surface": "#F7FAFB",
        "quote-wa": "#15803D", // 5.02:1 on white — WhatsApp CTA
        "quote-wa-hover": "#116B30", // 6.63:1
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
          "radial-gradient(circle at 20% 0%, rgba(51,59,160,0.14) 0%, rgba(237,241,249,0) 45%), radial-gradient(circle at 85% 15%, rgba(218,31,38,0.09) 0%, rgba(237,241,249,0) 40%)",
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
