import React, { useState } from 'react'
import { Box, Button, Input, Heading, VStack } from '@chakra-ui/react'
import api from '../api'
import { useNavigate } from 'react-router-dom'

const Signup = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleSignup = async () => {
    try {
      await api.post('/Auth/signup', { userName: username, password });
      alert('User created! Please login.')
      navigate('/login')
    } catch (err) {
      alert('Signup failed' + "\n" + err)
    }
  }

  return (
    <Box maxW="md" mx="auto" mt={20} p={6} borderWidth={1} borderRadius="lg">
      <Heading mb={6}>Signup</Heading>
      <VStack spacing={4}>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button colorScheme="teal" onClick={handleSignup}>
          Signup
        </Button>
      </VStack>
    </Box>
  )
}

export default Signup
