// src/theme.js
import { createSystem, defaultConfig, defineConfig, defineRecipe, Table } from "@chakra-ui/react"

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
      components: {
    Button: { defaultProps: { colorPalette: "brand" } },
    Badge:  { defaultProps: { colorPalette: "brand" } },
    Switch: { defaultProps: { colorPalette: "brand" } },
    Tabs:   { defaultProps: { colorPalette: "brand" } },
    Progress:{ defaultProps: { colorPalette: "brand" } },
    // agrega otros que uses seguido: Radio, Checkbox, Slider, etc.
  },
      colors: {
        // Escala brand (negros y grises)
        // colors.brand.ts (o dentro de theme.tokens)
      brand : {
        50:  { value: "#E8F2F2" }, // teal muy claro (fondos suaves)
        100: { value: "#CFE5E6" },
        200: { value: "#2596be" },
        300: { value: "#2596be" },
        400: { value: "#2596be" }, // bordes/hover
        500: { value: "#2596be" }, // color principal (botones, links)
        600: { value: "#2596be" }, // hover/active
        700: { value: "#2596be" }, // textos sobre tonos claros
        800: { value: "#1B4448" },
        900: { value: "#153238" }, // ¡match exacto con el fondo del logo!
      },
      },
    },
    // Opcional: tokens semánticos para “brand”
    semanticTokens: {
      colors: {
        "bg.panel": { value: { _light: "white",  _dark: "gray.900" } },
      "bg.subtle":{ value: { _light: "brand.100", _dark: "gray.800" } },
      "border.subtle": { value: { _light: "brand.300", _dark: "gray.700" } },
      },
    },
    // Registra el recipe del Button en el theme
    recipes: {
      button: buttonRecipe,
    },
  },
})

export const system = createSystem(defaultConfig, config)
