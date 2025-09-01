// src/pages/Forbidden.jsx
import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react"
import { useNavigate } from "react-router-dom"

export default function Forbidden() {
  const navigate = useNavigate()
  return (
    <Box minH="60vh" display="grid" placeItems="center">
      <Stack align="center" gap="3" textAlign="center" p="6" borderWidth="1px" rounded="lg" bg="white">
        <Heading size="lg">403 — Sin permisos</Heading>
        <Text color="fg.muted" maxW="md">
          No estás autorizado para ver este contenido. Si crees que es un error, contacta a un administrador.
        </Text>
        <Stack direction="row" gap="2">
          <Button onClick={() => navigate(-1)}>Volver</Button>
          <Button colorPalette="brand" onClick={() => navigate("/app")}><b>Ir al panel</b></Button>
        </Stack>
      </Stack>
    </Box>
  )
}
