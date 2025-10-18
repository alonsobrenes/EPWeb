// src/pages/public/InviteAcceptPage.jsx
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Box, Button, Card, Heading, Text, HStack, Spinner, VStack, Alert
} from "@chakra-ui/react"
import client from "../../api/client"
import { useAuth } from "../../auth/AuthProvider"

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function InviteAcceptPage() {
  const q = useQuery()
  const token = q.get("token") || ""
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)   // { valid, email, expiresAtUtc, status }
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        if (!token) {
          setData({ valid: false, status: "missing", email: "" })
          return
        }
        const { data } = await client.post(`/orgs/invitations/${encodeURIComponent(token)}/precheck`)
        if (mounted) setData(data)
      } catch {
        if (mounted) setData({ valid: false, status: "error", email: "" })
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [token])

  async function accept() {
    setAccepting(true)
    try {
      await client.post(`/orgs/invitations/${encodeURIComponent(token)}/accept`)
      navigate("/app", { replace: true })
    } catch (err) {
      alert("No se pudo aceptar la invitación. Revisa si venció o si no hay asientos disponibles.")
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <Box p="8">
        <HStack justify="center" color="fg.muted"><Spinner /><Text>Verificando invitación…</Text></HStack>
      </Box>
    )
  }

  if (!data?.valid) {
    return (
      <Box p="8" maxW="600px" mx="auto">
        <Card.Root>
          <Card.Body>
            <Heading size="md" mb="2">Invitación no válida</Heading>
            <Text color="fg.muted" mb="4">
              La invitación no existe, ya fue utilizada, fue revocada o ha expirado.
            </Text>
            <Button onClick={() => navigate("/", { replace: true })}>Ir al inicio</Button>
          </Card.Body>
        </Card.Root>
      </Box>
    )
  }

  return (
    <Box p="8" maxW="640px" mx="auto">
      <Card.Root>
        <Card.Body>
          <Heading size="md" mb="2">Invitación a unirse a la organización</Heading>
          <VStack align="start" gap="2" mb="4">
            <Text><strong>Email invitado:</strong> {data.email}</Text>
            <Text color="fg.muted">
              {data.expiresAtUtc
                ? `Vence: ${new Date(data.expiresAtUtc).toLocaleString()}`
                : `Sin fecha de vencimiento`}
            </Text>
          </VStack>

          {!isAuthenticated ? (
            <>
              <Alert.Root status="info" mb="4">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Acción requerida</Alert.Title>
                  <Alert.Description>Necesitas iniciar sesión o crear cuenta para aceptar.</Alert.Description>
                </Alert.Content>
              </Alert.Root>

              <HStack gap="3">
                <Button
                  onClick={() => navigate(`/signup?email=${encodeURIComponent(data.email)}&token=${encodeURIComponent(token)}`)}
                  colorPalette="blue"
                >
                  Crear cuenta
                </Button>
                <Button
                  onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`)}
                  variant="outline"
                >
                  Iniciar sesión
                </Button>
              </HStack>
            </>
          ) : (
            <HStack gap="3">
              <Button onClick={accept} loading={accepting} colorPalette="blue">
                Unirme a la organización
              </Button>
              <Button variant="outline" onClick={() => navigate("/app")}>Cancelar</Button>
            </HStack>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  )
}
