import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#09090B",
          50: "#1A1A22",
          100: "#141418",
          200: "#101014",
          300: "#0D0D10",
          400: "#09090B",
          surface: "#121215",
          card: "#18181C",
          cardHover: "#1F1F25",
          border: "rgba(255, 255, 255, 0.08)",
          borderHover: "rgba(255, 255, 255, 0.16)",
        },
        buzly: {
          emerald: {
            DEFAULT: "#10B981",
            glow: "rgba(16, 185, 129, 0.15)",
            light: "#34D399",
            dark: "#059669",
          },
          amber: {
            DEFAULT: "#F59E0B",
            glow: "rgba(245, 158, 11, 0.15)",
            light: "#FBBF24",
            dark: "#D97706",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        cairo: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-glow-amber": "pulseGlowAmber 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-glow-emerald": "pulseGlowEmerald 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "radar-sweep": "radarSweep 3s linear infinite",
        "bounce-subtle": "bounceSubtle 2s infinite ease-in-out",
        "flash-alert": "flashAlert 1s infinite alternate",
      },
      keyframes: {
        pulseGlowAmber: {
          "0%, 100%": {
            boxShadow: "0 0 15px rgba(245, 158, 11, 0.15), 0 0 35px rgba(245, 158, 11, 0.1)",
          },
          "50%": {
            boxShadow: "0 0 30px rgba(245, 158, 11, 0.45), 0 0 60px rgba(245, 158, 11, 0.25)",
          },
        },
        pulseGlowEmerald: {
          "0%, 100%": {
            boxShadow: "0 0 25px rgba(16, 185, 129, 0.3), 0 0 50px rgba(16, 185, 129, 0.2)",
            transform: "scale(1)",
          },
          "50%": {
            boxShadow: "0 0 60px rgba(16, 185, 129, 0.7), 0 0 100px rgba(16, 185, 129, 0.4)",
            transform: "scale(1.02)",
          },
        },
        radarSweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        bounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        flashAlert: {
          "0%": { backgroundColor: "rgba(16, 185, 129, 0.08)" },
          "100%": { backgroundColor: "rgba(16, 185, 129, 0.25)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
