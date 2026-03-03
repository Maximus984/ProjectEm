import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#030711",
        cosmic: "#0b1327",
        nova: "#1f4e79",
        aurora: "#00c2a8",
        flare: "#f7b267",
        text: "#e8f2ff",
        mist: "#8ea5c4"
      },
      fontFamily: {
        display: ["'Sora'", "'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "'Manrope'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,194,168,.28), 0 18px 55px rgba(0,0,0,.45)"
      }
    }
  },
  plugins: []
};

export default config;
