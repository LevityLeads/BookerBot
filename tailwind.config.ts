import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brand colors
        cyan: {
          DEFAULT: "#00E5CC",
          50: "#E5FFFC",
          100: "#B3FFF5",
          200: "#80FFEE",
          300: "#4DFFE7",
          400: "#1AFFE0",
          500: "#00E5CC",
          600: "#00B8A3",
          700: "#008A7A",
          800: "#005C52",
          900: "#002E29",
        },
        navy: {
          DEFAULT: "#0A1628",
          50: "#1E3A5F",
          100: "#1A3254",
          200: "#162A49",
          300: "#12223E",
          400: "#0E1A33",
          500: "#0A1628",
          600: "#08121F",
          700: "#060E18",
          800: "#040A10",
          900: "#020508",
        },
        purple: {
          DEFAULT: "#8B5CF6",
          glow: "#A78BFA",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(0, 229, 204, 0.4)",
          },
          "50%": {
            boxShadow: "0 0 30px rgba(0, 229, 204, 0.6)",
          },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shimmer": "shimmer 2s infinite",
        "float": "float 3s ease-in-out infinite",
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(0, 229, 204, 0.3)",
        "glow": "0 0 20px rgba(0, 229, 204, 0.4)",
        "glow-lg": "0 0 40px rgba(0, 229, 204, 0.5)",
        "glow-xl": "0 0 60px rgba(0, 229, 204, 0.6)",
        "inner-glow": "inset 0 0 20px rgba(0, 229, 204, 0.1)",
        "neu-dark": "8px 8px 16px hsl(222, 47%, 4%), -4px -4px 12px hsl(222, 47%, 12%)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-dark": "linear-gradient(180deg, hsl(222, 47%, 8%) 0%, hsl(222, 47%, 5%) 100%)",
        "gradient-card": "linear-gradient(145deg, hsl(222, 47%, 10%), hsl(222, 47%, 6%))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
