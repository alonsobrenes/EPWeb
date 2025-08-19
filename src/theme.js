// theme.js
import { createSystem, defaultConfig } from "@chakra-ui/react"

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50:  { value: "#eef2ff" },
          100: { value: "#e0e7ff" },
          500: { value: "#4F46E5" },  // azul principal
          700: { value: "#3730A3" },  // azul oscuro
        },
      },
    },
  },
})
