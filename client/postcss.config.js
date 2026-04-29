// Tailwind v4 moved its PostCSS plugin to a separate package: @tailwindcss/postcss
// The old config used `tailwindcss: {}` directly — that no longer works in v4.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
