import React from "react"
import { Box } from "@chakra-ui/react"
import logoUrl from "../assets/Logo-AlfaDoc.png" // Vite importa SVG como URL

export default function BrandLogo({ height = "120px", ...props }) {
  return (
    <Box
      as="img"
      src={logoUrl}
      alt="Alfa-Doc"
      height={height}
      // para que no se estire raro
      maxW="100%"
      objectFit="contain"
      {...props}
    />
  )
}
