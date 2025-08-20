// src/pages/LoginBlock.jsx
import React, { useState, useRef } from "react"
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"
import api from "../api/client"
import { validateLogin } from "../auth/authHelpers"
import { toaster } from "../components/ui/toaster"

import {
  Avatar,
  Box,
  Button,
  Card,
  Container,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  Link,
  Stack,
  Text,
  Alert,
  CloseButton,
} from "@chakra-ui/react"
import { LuLock, LuMail, LuEye, LuEyeOff } from "react-icons/lu"
import BrandLogo from "../components/BrandLogo"
import RightPanel from "../components/RightPanel"
import loginImage from "../assets/login-rp.png" // ← ajusta si usas otro nombre

export default function LoginBlock() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [formError, setFormError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")

  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  //const from = location.state?.from?.pathname || "/"

  const resetErrors = () => {
    setFormError("")
    setEmailError("")
    setPasswordError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    resetErrors()

    const { errors, isValid, firstInvalid } = validateLogin({ email, password })
    setEmailError(errors.email || "")
    setPasswordError(errors.password || "")

    if (!isValid) {
      if (firstInvalid === "email") emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    try {
      setSubmitting(true)

      const res = await api.post("/Auth/login", {
        email: email.trim().toLowerCase(),
        password,
      })
      const token = res?.data?.token
      const apiMsg = res?.data?.message

      if (!token) {
        const msg = apiMsg || "No se pudo iniciar sesión. Intenta nuevamente."
        setFormError(msg)
        setEmailError("Revisa el correo.")
        setPasswordError("Revisa la contraseña.")
        emailRef.current?.focus()
        toaster.error({ title: "Inicio de sesión fallido", description: msg })
        return
      }

      login(token)
      toaster.success({ title: "Bienvenido", description: "Sesión iniciada correctamente" })
      navigate("/app", { replace: true })
    } catch (err) {
      const status = err?.response?.status
      const apiMsg = err?.response?.data?.message
      let description = apiMsg || "Ocurrió un error al iniciar sesión."

      if (status === 401) {
        description = apiMsg || "Correo o contraseña incorrectos."
        setEmailError("Revisa el correo.")
        setPasswordError("Revisa la contraseña.")
        emailRef.current?.focus()
      } else if (status === 400) {
        description = apiMsg || "Solicitud inválida. Revisa los datos."
      } else if (status >= 500) {
        description = apiMsg || "Problema en el servidor. Intenta más tarde."
      } else if (err?.request) {
        description = "No hay conexión con el servidor. Verifica tu red."
      }

      setFormError(description)
      toaster.error({ title: "Inicio de sesión fallido", description })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Altura fija del viewport (móvil friendly) y sin overflow global
    <Flex h="100svh" flex="1" overflow="hidden">
      {/* Panel izquierdo: formulario */}
      <Box flex="1.5" display="flex">
        <Container maxW="md" my="auto" py={{ base: 8, md: 10 }} overflowY="auto">
          <Stack gap="8" as="form" onSubmit={handleSubmit} noValidate>
            <BrandLogo height={{ base: "80px", md: "100px" }} mx="auto" />

            <Stack gap={{ base: "2", md: "3" }} textAlign="center">
              <Heading size={{ base: "2xl", md: "3xl" }}>Inicia sesión</Heading>
              <Text color="fg.muted">Bienvenido de vuelta</Text>
            </Stack>

            {formError && (
              <Alert.Root status="error" role="alert" aria-live="polite" justifyContent="space-between">
                <Alert.Indicator />
                <Text>{formError}</Text>
                <CloseButton onClick={() => setFormError("")} />
              </Alert.Root>
            )}

            <Stack gap="6">
              <Stack gap="5">
                {/* Correo */}
                <Field.Root invalid={!!emailError}>
                  <Field.Label>Correo</Field.Label>
                  <InputGroup startElement={<LuMail />} width="full">
                    <Input
                      ref={emailRef}
                      type="email"
                      placeholder="tucorreo@dominio.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError("")
                        if (formError) setFormError("")
                      }}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "email-error" : undefined}
                      required
                    />
                  </InputGroup>
                  {emailError && <Field.ErrorText id="email-error">{emailError}</Field.ErrorText>}
                </Field.Root>

                {/* Contraseña con toggle 👁️ */}
                <Field.Root invalid={!!passwordError}>
                  <Field.Label>Contraseña</Field.Label>
                  <InputGroup
                    startElement={<LuLock />}
                    endElement={
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? <LuEyeOff /> : <LuEye />}
                      </Button>
                    }
                    width="full"
                  >
                    <Input
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (passwordError) setPasswordError("")
                        if (formError) setFormError("")
                      }}
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? "password-error" : undefined}
                      required
                    />
                  </InputGroup>
                  {passwordError && <Field.ErrorText id="password-error">{passwordError}</Field.ErrorText>}
                </Field.Root>

                <Button type="submit" isLoading={submitting} colorPalette="brand">
                  Ingresar
                </Button>

                <Link asChild variant="plain">
                  <RouterLink to="/signup">¿No tienes cuenta? Regístrate</RouterLink>
                </Link>
              </Stack>

              <Card.Root size="sm" mt="10">
                <Card.Body>
                  <HStack textStyle="sm">
                    <Avatar.Root size="xs">
                      <Avatar.Fallback />
                      <Avatar.Image src="https://i.pravatar.cc/300?u=12" />
                    </Avatar.Root>
                    <Text>¿Solo quieres explorar?</Text>
                    <Link variant="underline" href="/" fontWeight="semibold">
                      Volver al inicio
                    </Link>
                  </HStack>
                </Card.Body>
              </Card.Root>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Panel derecho: foto del login (si no la tienes, deja <RightPanel h="full" /> sin imageSrc) */}
      <RightPanel imageSrc={loginImage} gradient={false} overlayColor="blackAlpha.150" h="full" />
    </Flex>
  )
}
