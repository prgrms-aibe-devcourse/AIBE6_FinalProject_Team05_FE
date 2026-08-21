import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand tokens
        primary: { DEFAULT: "#EE1515", dark: "#B80F0F" },
        secondary: { DEFAULT: "#3B4CCA", dark: "#2C3AA0" },
        tertiary: "#FFCB05",
        neutral: "#F7F7F8",
        // Named panel colors
        navy: { DEFAULT: "#141A34", 800: "#1B2036", 700: "#1E264A" },
        lavender: "#EEF0FA",
        ink: "#1A1A1E",
        // Grade colors — S/A/B (S=gold 최상, A=blue, B=gray 차분)
        grade: {
          s: "#FFCB05",
          "s-ink": "#5A4300",
          a: "#3B4CCA",
          b: "#9CA3AF",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Subtle tactile / pressable button (game-flavored wink)
        tactile: "0 4px 0 rgba(184,15,15,0.5), 0 6px 14px rgba(238,21,21,0.22)",
        "tactile-hover": "0 5px 0 rgba(184,15,15,0.5), 0 8px 18px rgba(238,21,21,0.32)",
        "tactile-active": "0 2px 0 rgba(184,15,15,0.5)",
        "tactile-sm": "0 3px 0 rgba(184,15,15,0.5)",
        card: "0 10px 34px rgba(20,26,52,0.06)",
        lift: "0 12px 26px rgba(20,26,52,0.12)",
        panel: "-12px 0 40px rgba(20,26,52,0.18)",
      },
      maxWidth: {
        container: "1360px",
      },
      keyframes: {
        tickerScroll: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        ticker: "tickerScroll 32s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
