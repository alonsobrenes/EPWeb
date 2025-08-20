import React from "react"
import { Box } from "@chakra-ui/react"
import logoUrl from "../assets/logo.svg" // Vite importa SVG como URL

export default function BrandLogo({ height = "40px", ...props }) {
  return (
    <Box
      as="img"
      src={logoUrl}
      alt="Evaluación Psicológica Integral"
      height={height}
      // para que no se estire raro
      maxW="100%"
      objectFit="contain"
      {...props}
    />
  )
}
