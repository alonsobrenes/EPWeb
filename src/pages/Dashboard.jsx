import React from 'react'
import { Box, Button, Heading, VStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <Box maxW="lg" mx="auto" mt={20} p={6} borderWidth={1} borderRadius="lg">
      <Heading mb={6}>Dashboard</Heading>
      <VStack spacing={4}>
        <Button onClick={() => navigate('/app/disciplines')}>
          Manage Disciplines
        </Button>
        <Button onClick={() => navigate('/app/categories')}>
          Manage Categories
        </Button>
        <Button onClick={() => navigate('/app/subcategories')}>
          Manage Subcategories
        </Button>
        <Button colorScheme="red" onClick={logout}>
          Logout
        </Button>
      </VStack>
    </Box>
  )
}

export default Dashboard
