import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#102132",
        mist: "#f4efe6",
        sea: "#0f766e",
        ember: "#d97706",
        coral: "#be4b49"
      },
      fontFamily: {
        display: [
          "Georgia",
          "serif"
        ],
        body: [
          "\"Segoe UI\"",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
