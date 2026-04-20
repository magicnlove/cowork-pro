import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF7F3",
          100: "#FFF3EE",
          200: "#FDE8DE",
          300: "#F5C4A8",
          400: "#ED8B52",
          500: "#E8692A",
          600: "#E8692A",
          700: "#C45A1A",
          800: "#9A4514",
          900: "#6B300E"
        }
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.65" }],
        sm: ["14px", { lineHeight: "1.7" }],
        base: ["15px", { lineHeight: "1.7" }],
        lg: ["18px", { lineHeight: "1.6" }],
        xl: ["20px", { lineHeight: "1.5" }],
        "2xl": ["24px", { lineHeight: "1.4" }],
        "3xl": ["30px", { lineHeight: "1.3" }]
      },
      ringColor: {
        brand: "#E8692A"
      }
    }
  },
  plugins: []
};

export default config;
