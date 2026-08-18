/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0d12",
        "bg-elevated": "#0d1219",
        surface: "#131820",
        "surface-hover": "#171d26",
        "surface-2": "#1a2029",
        line: "#232a34",
        "line-soft": "#1a2029",
        ink: "#f0efe9",
        "ink-body": "#c6cbd6",
        "ink-muted": "#7d8798",
        "ink-muted-2": "#576273",
        accent: {
          DEFAULT: "#f97316",
          hover: "#ff8a3d",
          active: "#dd6510",
          text: "#0a0d12",
          soft: "rgba(249,115,22,0.14)",
          border: "rgba(249,115,22,0.4)",
        },
        danger: {
          DEFAULT: "#f2545b",
          soft: "rgba(242,84,91,0.14)",
          border: "rgba(242,84,91,0.4)",
        },
        success: {
          DEFAULT: "#34caa0",
          soft: "rgba(52,202,160,0.14)",
          border: "rgba(52,202,160,0.35)",
        },
        info: {
          DEFAULT: "#5fb0f0",
          soft: "rgba(95,176,240,0.14)",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
