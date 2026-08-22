import type { Config } from "tailwindcss";

const config: Config = {
  // hooks/도 스캔한다 — 클래스 문자열을 돌려주는 훅(useHeartPunch 등)이 있어서, 빠져 있으면
  // 그 클래스가 CSS로 아예 생성되지 않아 조용히 동작하지 않는다.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
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
        // 관심(하트) 등록 순간의 짧은 펀치 — 커졌다가 살짝 작아진 뒤 제자리로.
        heartPunch: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.3)" },
          "70%": { transform: "scale(0.92)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        ticker: "tickerScroll 32s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        // back-out 이징으로 스프링 느낌을 낸다. 호출부는 motion-safe: 접두사와 함께 써서
        // prefers-reduced-motion 사용자에게는 애니메이션이 아예 걸리지 않게 한다.
        "heart-punch": "heartPunch 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
