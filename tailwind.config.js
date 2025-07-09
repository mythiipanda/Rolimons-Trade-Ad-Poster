/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: [
    "./popup.tsx",
    "./contents/**/*.tsx",
    "./components/**/*.tsx",
    "./lib/**/*.tsx"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
