// src/theme.js
import { createSystem, defaultConfig, defineConfig, defineRecipe } from "@chakra-ui/react"

// --- Button recipe (ver sección 3) ---
const buttonRecipe = defineRecipe({
  base: {
    fontWeight: "semibold",
    rounded: "lg",
    transitionProperty: "common",
    transitionDuration: "normal",
  },
  variants: {
    visual: {
      solid: {
        bg: "{colors.brand.600}",
        color: "white",
        _hover: { bg: "{colors.brand.700}" },
        _active: { bg: "{colors.brand.800}" },
      },
      outline: {
        bg: "transparent",
        borderWidth: "1px",
        borderColor: "{colors.brand.400}",
        color: "{colors.brand.700}",
        _hover: { bg: "{colors.brand.50}" },
        _active: { bg: "{colors.brand.100}" },
      },
      ghost: {
        bg: "transparent",
        color: "{colors.brand.700}",
        _hover: { bg: "{colors.brand.50}" },
        _active: { bg: "{colors.brand.100}" },
      },
    },
    size: {
      sm: { px: 3, py: 2, fontSize: "sm" },
      md: { px: 4, py: 2.5, fontSize: "md" },
      lg: { px: 5, py: 3, fontSize: "md" },
    },
  },
  defaultVariants: {
    visual: "solid",
    size: "md",
  },
})

// --- Config del sistema + tokens ---
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        // Escala brand (negros y grises)
        brand: {
          50:  { value: "#f7f7f7" },
          100: { value: "#ededed" },
          200: { value: "#e3e3e3" },
          300: { value: "#d1d1d1" }, // del SVG
          400: { value: "#a8a8a8" },
          500: { value: "#6f6f6f" },
          600: { value: "#3d3d3d" },
          700: { value: "#1f1f1f" },
          800: { value: "#121212" },
          900: { value: "#000000" }, // del SVG
        },
      },
    },
    // Opcional: tokens semánticos para “brand”
    semanticTokens: {
      colors: {
        brand: {
          solid:    { value: "{colors.brand.600}" },
          contrast: { value: "white" },
          fg:       { value: "{colors.brand.700}" },
          muted:    { value: "{colors.brand.600}" },
        },
      },
    },
    // Registra el recipe del Button en el theme
    recipes: {
      button: buttonRecipe,
    },
  },
})

export const system = createSystem(defaultConfig, config)
