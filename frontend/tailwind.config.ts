import type { Config } from "tailwindcss";

/**
 * The colour system lives in CSS custom properties (see app/globals.css) so that
 * light and dark are two independently designed palettes rather than one
 * inverted palette. Tailwind consumes them through `hsl(var(--token))`.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        surface: "hsl(var(--surface))",
        elevated: "hsl(var(--elevated))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        ink: "hsl(var(--ink))",
        body: "hsl(var(--body))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        "accent-ink": "hsl(var(--accent-ink))",
        ring: "hsl(var(--ring))",
        danger: "hsl(var(--danger))",
        success: "hsl(var(--success))",
        emotion: {
          joy: "hsl(var(--joy))",
          sadness: "hsl(var(--sadness))",
          love: "hsl(var(--love))",
          anger: "hsl(var(--anger))",
          fear: "hsl(var(--fear))",
          surprise: "hsl(var(--surprise))",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // Fluid display sizes — the hero must hold its presence from 360px to 1440px.
        display: ["clamp(2.5rem, 6.5vw, 5rem)", { lineHeight: "0.98", letterSpacing: "-0.035em" }],
        headline: ["clamp(1.85rem, 3.4vw, 3rem)", { lineHeight: "1.08", letterSpacing: "-0.028em" }],
        title: ["clamp(1.25rem, 1.9vw, 1.6rem)", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 hsl(var(--shadow) / 0.28)",
        card: "0 1px 2px hsl(var(--shadow) / 0.24), 0 12px 32px -12px hsl(var(--shadow) / 0.5)",
        lifted: "0 2px 4px hsl(var(--shadow) / 0.22), 0 24px 60px -20px hsl(var(--shadow) / 0.62)",
        "inner-hair": "inset 0 1px 0 0 hsl(var(--hairline) / 0.7)",
      },
      transitionTimingFunction: {
        // A single easing curve everywhere keeps motion feeling like one system.
        product: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.55", transform: "scale(0.92)" },
          "70%,100%": { opacity: "0", transform: "scale(1.5)" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -3%, 0) scale(1.08)" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.22,1,0.36,1) infinite",
        drift: "drift 18s ease-in-out infinite",
        "caret-blink": "caret-blink 1.1s steps(1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
