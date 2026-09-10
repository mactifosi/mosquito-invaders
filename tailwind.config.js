/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        arcade: ["Silkscreen", "Courier New", "monospace"],
        plex: ["IBM Plex Mono", "ui-monospace", "Menlo", "monospace"],
      },
      colors: {
        cabinet: {
          field: "#0b0910",
          bezel: "#170f22",
          raised: "#1f1530",
          edge: "#33254a",
          ink: "#efe6ff",
          dim: "#9a8cb4",
        },
        citronella: "#ffb02e",
      },
    },
  },
  plugins: [],
};
