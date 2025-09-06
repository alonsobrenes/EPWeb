// src/pages/Pricing.jsx
import React, { useEffect, useMemo, useState } from "react"
import {
  Box, Button, Card, Container, Flex, Grid, Heading, HStack, Icon, Link, Stack, Text, Badge, VisuallyHidden,
} from "@chakra-ui/react"
import { useNavigate, Link as RouterLink } from "react-router-dom"
import { LuArrowRight, LuCheck, LuMinus, LuMessageSquare, LuShieldCheck, LuSparkles } from "react-icons/lu"
import { motion } from "framer-motion"
import BrandLogo from "../components/BrandLogo"
import pricingConfig from "../config/pricing.config"

const MotionDiv = motion.div
const viewportOnce = { once: true, amount: 0.25 }
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } } }
const scaleIn = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: "easeOut" } } }

export default function Pricing() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState("monthly") // 'monthly' | 'yearly'

  // Asegura que al entrar via navegación el scroll esté arriba
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [])

  const monthlyPlans = pricingConfig.monthly.map(p => ({
    ...p,
    currency: pricingConfig.currency ?? "$",
    period: "mes",
  }))

  const yearlyPlans = useMemo(() => {
    const mult = pricingConfig.yearlyMultiplier ?? 10
    return pricingConfig.monthly.map(p => ({
      ...p,
      currency: pricingConfig.currency ?? "$",
      price: p.price ? p.price * mult : 0,
      period: "año",
    }))
  }, [])

  const plans = billing === "monthly" ? monthlyPlans : yearlyPlans
  const compare = pricingConfig.compare ?? []

  return (
    <Box bg="white" minH="100dvh">
      {/* Header */}
      <Box as="header" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <Container maxW="7xl" py="3">
          <HStack justify="space-between">
            <HStack gap="3">
              <BrandLogo height={{ base: "34px", md: "40px" }} />
              <Text display={{ base: "none", md: "block" }} color="fg.muted">evaluacionpsicologica.org</Text>
            </HStack>
            <HStack gap="3">
              <Link asChild><RouterLink to="/">Inicio</RouterLink></Link>
              <Link asChild><RouterLink to="/login">Login</RouterLink></Link>
              <Link asChild><RouterLink to="/signup">Signup</RouterLink></Link>
              <Button variant="outline" leftIcon={<LuMessageSquare />} as={RouterLink} to="https://wa.me/###########" target="_blank">
                WhatsApp
              </Button>
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Hero */}
      <Box as="section" py={{ base: 12, md: 20 }}>
        <Container maxW="7xl">
          <MotionDiv variants={fadeIn} initial="hidden" animate="show">
            <Stack gap="6" textAlign="center" align="center">
              <Heading size={{ base: "2xl", md: "3xl" }}>Planes por uso — crece a tu ritmo</Heading>
              <Text color="fg.muted" fontSize={{ base: "md", md: "lg" }}>
                Pagás solo por lo que necesitás. Hecho para consultorios y centros educativos en LATAM.
              </Text>
              <HStack role="tablist" aria-label="Frecuencia de facturación" borderWidth="1px" rounded="md" p="1" gap="1">
                <Button role="tab" aria-selected={billing === "monthly"} onClick={() => setBilling("monthly")}
                        colorPalette={billing === "monthly" ? "brand" : undefined}
                        variant={billing === "monthly" ? "solid" : "ghost"}>
                  Mensual
                </Button>
                <Button role="tab" aria-selected={billing === "yearly"} onClick={() => setBilling("yearly")}
                        colorPalette={billing === "yearly" ? "brand" : undefined}
                        variant={billing === "yearly" ? "solid" : "ghost"}>
                  Anual <VisuallyHidden>(ahorro aprox.)</VisuallyHidden>
                </Button>
              </HStack>
              <HStack color="fg.muted">
                <Icon as={LuShieldCheck} aria-hidden />
                <Text textStyle="sm">Datos protegidos y PDFs listos para expediente</Text>
              </HStack>
            </Stack>
          </MotionDiv>
        </Container>
      </Box>

      {/* Grid de planes (siempre visible al montar) */}
      <Box as="section" py={{ base: 6, md: 8 }}>
        <Container maxW="7xl">
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={{ base: 6, md: 8 }}>
            {plans.map((p) => (
              <MotionDiv key={`${billing}-${p.name}`} variants={scaleIn} initial="hidden" animate="show">
                <Card.Root
                  h="full"
                  borderWidth={p.popular ? "2px" : "1px"}
                  borderColor={p.popular ? "brand.300" : "blackAlpha.200"}
                  boxShadow={p.popular ? "lg" : "md"}
                  position="relative"
                >
                  {p.popular && (
                    <Badge position="absolute" top="3" right="3" colorPalette="brand">Popular</Badge>
                  )}
                  <Card.Body p="6" gap="5">
                    <Stack gap="1">
                      <Text color="fg.muted" textStyle="sm">{p.highlight}</Text>
                      <Heading size="lg">{p.name}</Heading>
                    </Stack>

                    <HStack align="baseline" gap="1">
                      <Text fontSize="4xl" fontWeight="bold">{p.currency}{p.price}</Text>
                      <Text color="fg.muted">/{p.period}</Text>
                    </HStack>

                    <Stack as="ul" gap="2">
                      {p.features?.map((f, i) => (
                        <HStack as="li" key={i} align="start" gap="2">
                          <Icon as={LuCheck} mt="1" aria-hidden />
                          <Text>{f}</Text>
                        </HStack>
                      ))}
                    </Stack>

                    <Button
                      colorPalette="brand"
                      variant={p.ctaVariant ?? "outline"}
                      as={RouterLink}
                      to={p.ctaTo ?? "/signup"}
                      target={p.ctaTo?.startsWith?.("http") ? "_blank" : undefined}
                      rightIcon={<LuArrowRight />}
                    >
                      {p.ctaLabel ?? "Elegir plan"}
                    </Button>
                  </Card.Body>
                </Card.Root>
              </MotionDiv>
            ))}
          </Grid>

          <Text mt="4" color="fg.muted" textStyle="sm">
            * Precios de ejemplo. Ajustá números y límites en <code>src/config/pricing.config.js</code>.
          </Text>
        </Container>
      </Box>

      {/* Comparativa simple */}
      <Box as="section" py={{ base: 12, md: 16 }} bg="gray.50">
        <Container maxW="7xl">
          <Stack gap="6" textAlign="center">
            <Heading size="xl">Compará características</Heading>
            <Grid templateColumns={{ base: "1fr", md: "2fr repeat(3, 1fr)" }} borderWidth="1px" borderColor="blackAlpha.200" rounded="md">
              <Box p="4" borderBottomWidth="1px" textAlign="left" fontWeight="semibold">Característica</Box>
              <Box p="4" borderBottomWidth="1px" textAlign="center" fontWeight="semibold">Starter</Box>
              <Box p="4" borderBottomWidth="1px" textAlign="center" fontWeight="semibold">Clínica</Box>
              <Box p="4" borderBottomWidth="1px" textAlign="center" fontWeight="semibold">Institucional</Box>

              {compare.map((row, i) => (
                <React.Fragment key={i}>
                  <Box p="4" borderTopWidth="1px" textAlign="left" bg="white">{row.label}</Box>
                  {row.values.map((val, j) => (
                    <Box key={j} p="4" borderTopWidth="1px" textAlign="center" bg="white">
                      {typeof val === "string" ? <Text>{val}</Text> : val ? <Icon as={LuCheck} /> : <Icon as={LuMinus} />}
                    </Box>
                  ))}
                </React.Fragment>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* CTA final */}
      <Box as="section" py={{ base: 12, md: 16 }} bg="brand.900" color="white">
        <Container maxW="7xl">
          <MotionDiv variants={fadeIn} initial="hidden" animate="show">
            <Flex direction={{ base: "column", md: "row" }} align="center" justify="space-between" gap="6">
              <Stack gap="2">
                <Heading size={{ base: "xl", md: "2xl" }}>¿Listo para empezar?</Heading>
                <HStack color="whiteAlpha.800"><Icon as={LuSparkles} /><Text>Creá tu cuenta y probá los módulos hoy mismo.</Text></HStack>
              </Stack>
              <HStack gap="3" wrap="wrap">
                <Button colorPalette="brand" onClick={() => navigate("/signup")} rightIcon={<LuArrowRight />}>Crear cuenta</Button>
                <Link asChild color="whiteAlpha.900"><RouterLink to="/login">Iniciar sesión</RouterLink></Link>
              </HStack>
            </Flex>
          </MotionDiv>
        </Container>
      </Box>
    </Box>
  )
}
