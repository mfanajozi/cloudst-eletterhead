/**
 * CloudST brand constants — mirrors the @theme tokens in app/globals.css.
 * Charcoal: dark surfaces (700–900), light content text (50–500).
 * Gold:     #d4af37 brand gold as the 200 anchor.
 */
export const COLORS = {
  charcoal: {
    50: "#fafafa",
    100: "#e4e4e4",
    200: "#2a2a2a",
    300: "#a3a3a3",
    400: "#8a8a8a",
    500: "#6b6b6b",
    600: "#262626",
    700: "#1f1f1f",
    800: "#161616",
    900: "#0a0a0a",
  },
  gold: {
    50: "#faf3dd",
    100: "#e6d08e",
    200: "#d4af37",
    300: "#b8942c",
    400: "#b8942c",
    500: "#8a6d1f",
  },
} as const;

export const BRAND = {
  name: "CloudST eLetterhead",
  logo: "/cloudst-logo-trans.png",
  favicon: "/cloudst-favicon.png",
} as const;
