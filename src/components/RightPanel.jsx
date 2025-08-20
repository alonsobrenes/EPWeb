import React from "react"
import { Box } from "@chakra-ui/react"
import logoUrl from "../assets/logo.svg" // watermark por defecto

export default function RightPanel({
  imageSrc,                 // ← imagen opcional para el panel
  imageFit = "cover",       // "cover" | "contain"
  gradient = !imageSrc,     // si hay foto, apaga el gradiente por default
  overlay = true,           // capa de oscurecimiento sutil
  overlayColor = "blackAlpha.150",
  children,
  ...props
}) {
  return (
    <Box
      flex="1"
      hideBelow="lg"
      h="inherit"
      position="relative"
      overflow="hidden"
      {...props}
    >
      {gradient && (
        <Box
          position="absolute"
          inset="0"
          bgGradient="linear(to-br, brand.900, brand.700)"
        />
      )}

      {imageSrc ? (
        <Box
          as="img"
          src={imageSrc}
          alt=""                 // decorativa; si necesitas texto, pásalo fuera
          aria-hidden="true"
          position="absolute"
          inset="0"
          w="full"
          h="full"
          objectFit={imageFit}
        />
      ) : (
        // Watermark del logo si no hay imagen
        <Box
          position="absolute"
          inset="0"
          backgroundImage={`url(${logoUrl})`}
          backgroundRepeat="no-repeat"
          backgroundPosition="center"
          backgroundSize={{ base: "260px", md: "340px", lg: "420px" }}
          opacity="0.07"
          filter="grayscale(100%)"
        />
      )}

      {overlay && <Box position="absolute" inset="0" bg={overlayColor} />}

      {children}
    </Box>
  )
}
