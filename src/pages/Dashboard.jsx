// src/pages/Dashboard.jsx
import React from "react"
import { Box, Button, Heading, VStack } from "@chakra-ui/react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"

export default function Dashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout() // limpia authToken y estado
    navigate("/login", { replace: true })
  }

  return (
    <Box maxW="lg" mx="auto" mt={20} p={6} borderWidth={1} borderRadius="lg">
      <Heading mb={6}>Dashboard</Heading>
      <VStack spacing={4}>
        <Button onClick={() => navigate("/app/disciplines")}>Manage Disciplines</Button>
        <Button onClick={() => navigate("/app/categories")}>Manage Categories</Button>
        <Button onClick={() => navigate("/app/subcategories")}>Manage Subcategories</Button>
        <Button colorPalette="red" onClick={handleLogout}>Logout</Button>
      </VStack>
    </Box>
  )
}
