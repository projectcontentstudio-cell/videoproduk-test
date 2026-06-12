import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090d",
        surface: "#11131a",
        border: "#262936",
        primary: "#2dd4bf",
        accent: "#fbbf24"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        glow: "0 0 40px rgba(45, 212, 191, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
