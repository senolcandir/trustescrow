import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#10131A",
          soft: "#171B24",
          line: "#262B36",
        },
        paper: {
          DEFAULT: "#E7E9E2",
          dim: "#D9DCD2",
          deep: "#C9CDBF",
        },
        seal: {
          DEFAULT: "#B8863B",
          bright: "#D3A24F",
          dim: "#8A6329",
        },
        ember: {
          DEFAULT: "#9A3324",
          bright: "#C24632",
        },
        moss: {
          DEFAULT: "#4B6B4F",
          bright: "#5F8564",
        },
        slate: {
          DEFAULT: "#7C8794",
          dim: "#565E68",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        wideish: "0.08em",
        label: "0.16em",
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(231,233,226,0.035) 1px, transparent 0)",
      },
      backgroundSize: {
        grain: "3px 3px",
      },
    },
  },
  plugins: [],
};

export default config;
