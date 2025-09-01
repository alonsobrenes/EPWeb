// src/components/ErrorBoundary.jsx
import React from "react"
import { Box, Button, Text } from "@chakra-ui/react"

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info)
  }
  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <Box p="6">
          <Text fontWeight="bold" mb="2">Algo salió mal.</Text>
          <Text fontSize="sm" color="fg.muted" mb="4">
            {String(this.state.error?.message || this.state.error || "Error")}
          </Text>
          <Button onClick={this.reset}>Reintentar</Button>
        </Box>
      )
    }
    return this.props.children
  }
}
