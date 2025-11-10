import React from "react"
import { Box } from "@chakra-ui/react"
import Logo from "../assets/Logo.png" // Vite importa SVG como URL

export default function BrandLogo({ height = "70px", ...props }) {
  return (
    <Box
      as="img"
      src={Logo}
      alt="Alfa-Doc"
      height={height}
      // para que no se estire raro
      maxW="100%"
      objectFit="contain"
      {...props}
    />
  )
}
