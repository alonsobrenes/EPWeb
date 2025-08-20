// src/pages/SignupBlock.jsx
import React, { useRef, useState } from "react"
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom"
import { useAuth } from "../auth/AuthProvider"
import api from "../api/client"
import { validateSignup, getPasswordStrength } from "../auth/authHelpers"
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
import signupImage from "../assets/signup-rp.png"

export default function SignupBlock() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [formError, setFormError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmError, setConfirmError] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || "/"

  const resetErrors = () => {
    setFormError("")
    setEmailError("")
    setPasswordError("")
    setConfirmError("")
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const handleSubmit = async (e) => {
    e.preventDefault()
    resetErrors()

    const { errors, isValid, firstInvalid } = validateSignup({
      email,
      password,
      confirmPassword,
      enforceComplexity: true,
    })

    setEmailError(errors.email || "")
    setPasswordError(errors.password || "")
    setConfirmError(errors.confirm || "")

    if (!isValid) {
      if (firstInvalid === "email") emailRef.current?.focus()
      else if (firstInvalid === "password") passwordRef.current?.focus()
      else confirmRef.current?.focus()
      return
    }

    try {
      setSubmitting(true)
      const cleanEmail = email.trim().toLowerCase()

      // 1) Crear usuario
      const res = await api.post("/Auth/signup", { email: cleanEmail, password })
      const token = res?.data?.token

      if (token) {
        // 2a) Signup devuelve token → iniciar sesión
        login(token)
        toaster.success({ title: "Cuenta creada", description: "Sesión iniciada" })
        navigate("/", { replace: true })
        return
      }

      // 2b) Auto-login con fallback (email → userName)
      await sleep(150)

      const tryLogin = async () => {
        try {
          const r1 = await api.post("/Auth/login", { email: cleanEmail, password })
          if (r1?.data?.token) return r1.data.token
        } catch (_) {}
        try {
          const r2 = await api.post("/Auth/login", { userName: cleanEmail, password })
          if (r2?.data?.token) return r2.data.token
        } catch (_) {}
        return null
      }

      const loginToken = await tryLogin()
      if (loginToken) {
        login(loginToken)
        toaster.success({ title: "Cuenta creada", description: "Sesión iniciada" })
        navigate("/", { replace: true })
        return
      }

      toaster.success({ title: "Cuenta creada", description: "Inicia sesión para continuar" })
      navigate("/login", { replace: true, state: { from } })
    } catch (err) {
      const status = err?.response?.status
      const apiMsg = err?.response?.data?.message

      let description = apiMsg || "No se pudo crear la cuenta. Intenta más tarde."
      if (err?.code === "ERR_NETWORK") description = "No pudimos contactar el backend."
      else if (status === 409) description = apiMsg || "El correo ya está registrado."
      else if (status === 400) description = apiMsg || "Datos inválidos. Revisa e inténtalo de nuevo."
      else if (status >= 500) description = apiMsg || "Problema en el servidor. Intenta más tarde."

      setFormError(description)
      toaster.error({ title: "Error al registrarse", description })
    } finally {
      setSubmitting(false)
    }
  }

  const strength = getPasswordStrength(password)

  return (
    <Flex h="100svh" flex="1" overflow="hidden">
      {/* Panel izquierdo: formulario */}
      <Box flex="1.5" display="flex">
        <Container maxW="md" my="auto" py={{ base: 8, md: 10 }} overflowY="auto">
          <Stack gap="8" as="form" onSubmit={handleSubmit} noValidate>
            <BrandLogo height={{ base: "80px", md: "100px" }} mx="auto" />

            <Stack gap={{ base: "2", md: "3" }} textAlign="center">
              <Heading size={{ base: "2xl", md: "3xl" }}>Crear cuenta</Heading>
              <Text color="fg.muted">Únete a evaluacionpsicologica.org</Text>
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

                {/* Contraseña */}
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

                  {/* Barra de fortaleza */}
                  {password.length > 0 && (
                    <Stack gap="1">
                      <Box
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(strength.percent)}
                        aria-label="Fortaleza de la contraseña"
                        bg="gray.200"
                        h="2"
                        rounded="full"
                        overflow="hidden"
                      >
                        <Box
                          h="full"
                          w={`${strength.percent}%`}
                          bg={strength.color}
                          transition="width 0.2s ease"
                        />
                      </Box>
                      <Text textStyle="sm" color={strength.color}>
                        Fortaleza: {strength.label}
                      </Text>
                    </Stack>
                  )}
                </Field.Root>

                {/* Confirmar contraseña */}
                <Field.Root invalid={!!confirmError}>
                  <Field.Label>Confirmar contraseña</Field.Label>
                  <InputGroup
                    startElement={<LuLock />}
                    endElement={
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setShowConfirm((s) => !s)}
                        aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                      >
                        {showConfirm ? <LuEyeOff /> : <LuEye />}
                      </Button>
                    }
                    width="full"
                  >
                    <Input
                      ref={confirmRef}
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (confirmError) setConfirmError("")
                        if (formError) setFormError("")
                      }}
                      aria-invalid={!!confirmError}
                      aria-describedby={confirmError ? "confirm-error" : undefined}
                      required
                    />
                  </InputGroup>
                  {confirmError && <Field.ErrorText id="confirm-error">{confirmError}</Field.ErrorText>}
                </Field.Root>

                <Button type="submit" isLoading={submitting} colorPalette="brand">
                  Crear cuenta
                </Button>

                <Link asChild variant="plain">
                  <RouterLink to="/login">¿Ya tienes cuenta? Inicia sesión</RouterLink>
                </Link>
              </Stack>

              <Card.Root size="sm" mt="10">
                <Card.Body>
                  <HStack textStyle="sm">
                    <Avatar.Root size="xs">
                      <Avatar.Fallback />
                      <Avatar.Image src="https://i.pravatar.cc/300?u=99" />
                    </Avatar.Root>
                    <Text>¿Solo quieres explorar?</Text>
                    <Link variant="underline" href="/login" fontWeight="semibold">
                      Ir al inicio de sesión
                    </Link>
                  </HStack>
                </Card.Body>
              </Card.Root>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Panel derecho con la imagen fotorealista */}
      <RightPanel imageSrc={signupImage} gradient={false} overlayColor="blackAlpha.150" h="full" />
    </Flex>
  )
}
