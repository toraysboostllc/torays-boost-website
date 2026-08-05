/**
 * Brand tokens color-picked directly from the official logo file
 * (D:\Torays Logo\logo-01.png — red center #DA1F26, navy bars #20266F).
 * Site theme is light/premium (white, soft neutrals) — red/navy stay exact.
 */
export const theme = {
  colors: {
    red: {
      DEFAULT: "#DA1F26",
      dark: "#AE1620",
      light: "#F04A4F",
    },
    navy: {
      DEFAULT: "#20266F",
      dark: "#171B52",
      light: "#333BA0",
    },
    // bg is the page canvas (soft blue-gray, not flat white); surface is
    // white so cards pop with contrast against it, per the Stripe-style
    // reference the user asked to get closer to.
    neutral: {
      bg: "#EDF1F9",
      surface: "#FFFFFF",
      surfaceAlt: "#F4F6FB",
      line: "rgba(15,20,36,0.10)",
    },
    text: {
      primary: "#0F1424",
      secondary: "#525B78",
      muted: "#8A91AC",
    },
  },
  glow: {
    red: "0 8px 24px rgba(218,31,38,0.16)",
    navy: "0 8px 24px rgba(32,38,111,0.12)",
  },
  fonts: {
    heading: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
  },
};
