// src/pages/Landing.jsx
import React, { useEffect, useMemo, useState } from "react"
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  Link,
  Stack,
  Text,
  Avatar,
  VisuallyHidden,
} from "@chakra-ui/react"
import { useNavigate, Link as RouterLink } from "react-router-dom"
import {
  LuSparkles,
  LuShieldCheck,
  LuTrendingUp,
  LuArrowRight,
  LuMessageSquare,
  LuTabletSmartphone,
  LuFileDown,
  LuBrain,
  LuUserCheck,
} from "react-icons/lu"
import { motion, useReducedMotion } from "framer-motion"

import BrandLogo from "../components/BrandLogo"
import heroImage from "../assets/landing.png"

/* Animaciones (scroll-triggered) */
const MotionDiv = motion.div
const viewportOnce = { once: true, amount: 0.25 }
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" } } }
const slideUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } } }
const slideRight = { hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } } }
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } } }

/* Typewriter accesible */
function Typewriter({ phrases, speed = 28 }) {
  const prefersReduced = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState(phrases[0])

  useEffect(() => {
    if (prefersReduced) {
      setText(phrases[0])
      return
    }
    let i = 0
    let active = true
    const phrase = phrases[idx % phrases.length]
    setText("")
    const tick = () => {
      if (!active) return
      if (i <= phrase.length) {
        setText(phrase.slice(0, i))
        i += 1
        setTimeout(tick, speed)
      } else {
        setTimeout(() => active && setIdx((n) => (n + 1) % phrases.length), 1600)
      }
    }
    tick()
    return () => { active = false }
  }, [idx, phrases, speed, prefersReduced])

  return (
    <Box>
      <VisuallyHidden aria-live="polite">{text}</VisuallyHidden>
      <Box aria-hidden="true">
        {text}
        <Box as="span" ml="1" borderLeftWidth="2px" borderColor="fg" display="inline-block" h="1em" />
      </Box>
    </Box>
  )
}

/* Mockup simple */
function DeviceFrame({ src, alt = "Vista previa de evaluacionpsicologica.org" }) {
  return (
    <Box position="relative" w={{ base: "full", md: "560px" }} h={{ base: "300px", md: "380px" }}
         rounded="2xl" borderWidth="1px" borderColor="blackAlpha.200" bg="white" boxShadow="lg" overflow="hidden">
      <HStack px="4" py="3" borderBottomWidth="1px" borderColor="blackAlpha.100" bg="gray.50">
        <Box boxSize="2.5" rounded="full" bg="red.300" />
        <Box boxSize="2.5" rounded="full" bg="yellow.300" />
        <Box boxSize="2.5" rounded="full" bg="green.300" />
        <Text textStyle="sm" color="fg.muted" ml="auto">preview.evaluacionpsicologica.org</Text>
      </HStack>
      <Image src={src} alt={alt} position="absolute" inset="0" w="full" h="full" objectFit="cover" />
      <Box position="absolute" inset="0" bgGradient="linear(to-t, blackAlpha.100, transparent)" />
    </Box>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const heroPhrases = useMemo(() => [
    "Menos fricción, más clínica.",
    "Tus evaluaciones, claras y a tiempo.",
    "De la prueba al PDF —en minutos.",
  ], [])

  return (
    <Box bg="white">
      {/* Header */}
      <Box as="header" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <Container maxW="7xl" py="3">
          <HStack justify="space-between">
            <HStack gap="3">
              <BrandLogo height={{ base: "34px", md: "40px" }} />
              <Text display={{ base: "none", md: "block" }} color="fg.muted">evaluacionpsicologica.org</Text>
            </HStack>
            <HStack gap="2">
              {/* Solo Iniciar sesión y WhatsApp en el header */}
              <Button variant="ghost" onClick={() => navigate("/login")}>Iniciar sesión</Button>
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
          <Flex gap={{ base: 10, lg: 16 }} direction={{ base: "column", lg: "row" }} align="center">
            <MotionDiv variants={slideRight} initial="hidden" whileInView="show" viewport={viewportOnce} style={{ width: "100%" }}>
              <Stack gap="6" textAlign={{ base: "center", lg: "left" }}>
                <Heading size={{ base: "3xl", md: "4xl" }} lineHeight="1.1">
                  <Typewriter phrases={heroPhrases} />
                </Heading>
                <Text fontSize={{ base: "lg", md: "xl" }} color="fg.muted">
                  Plataforma latinoamericana para aplicar tests, generar resultados claros y organizar cada caso con apoyo de IA.
                  Lista para tablet y laptop.
                </Text>
                {/* Solo dos botones aquí: Crear cuenta y Planes y precios */}
                <HStack justify={{ base: "center", lg: "flex-start" }} gap="3" wrap="wrap">
                  <Button size="lg" colorPalette="brand" onClick={() => navigate("/signup")}>Crear cuenta</Button>
                  <Button as={RouterLink} to="/pricing" variant="outline" size="lg">Planes y precios</Button>
                </HStack>
                <HStack justify={{ base: "center", lg: "flex-start" }} color="fg.muted">
                  <Icon as={LuShieldCheck} aria-hidden />
                  <Text textStyle="sm">Datos protegidos y PDFs listos para expediente</Text>
                </HStack>
              </Stack>
            </MotionDiv>

            <MotionDiv variants={fadeIn} initial="hidden" whileInView="show" viewport={viewportOnce} style={{ width: "100%" }}>
              <Box display="flex" justifyContent={{ base: "center", lg: "flex-end" }}>
                <DeviceFrame src={heroImage} />
              </Box>
            </MotionDiv>
          </Flex>
        </Container>
      </Box>

      {/* Franja de confianza */}
      <Box as="section" py="6" bg="gray.50">
        <Container maxW="7xl">
          <MotionDiv variants={fadeIn} initial="hidden" whileInView="show" viewport={viewportOnce}>
            <HStack justify="center" wrap="wrap" gap="6" color="fg.muted">
              <HStack><Icon as={LuShieldCheck} aria-hidden /><Text>Soporte en español</Text></HStack>
              <HStack><Icon as={LuTabletSmartphone} aria-hidden /><Text>Optimizado para tablet y laptop</Text></HStack>
              <HStack><Icon as={LuFileDown} aria-hidden /><Text>PDFs claros y trazables</Text></HStack>
            </HStack>
          </MotionDiv>
        </Container>
      </Box>

      {/* Dolor → Solución */}
      <Box as="section" py={{ base: 10, md: 16 }} bg="gray.50">
        <Container maxW="7xl">
          <Stack gap="10" textAlign="center">
            <Stack gap="2">
              <Heading size="xl">Resuelve tus 3 dolores principales</Heading>
              <Text color="fg.muted">Menos logística. Más clínica.</Text>
            </Stack>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={{ base: 6, md: 8 }}>
              {[
                { icon: LuSparkles, title: "Ahorro de tiempo", desc: "Runner simple y sin distracciones; resultados al instante." },
                { icon: LuFileDown, title: "Entrega profesional", desc: "PDF limpio y consistente para familias, escuelas y expediente." },
                { icon: LuTrendingUp, title: "Visión de la práctica", desc: "Actividad semanal y pruebas más usadas para decidir mejor." },
              ].map((f, i) => (
                <MotionDiv key={i} variants={scaleIn} initial="hidden" whileInView="show" viewport={viewportOnce}>
                  <Card.Root h="full" borderWidth="1px" borderColor="blackAlpha.200"
                             transition="transform .25s ease, box-shadow .25s ease"
                             _hover={{ transform: "translateY(-4px)", boxShadow: "xl" }}>
                    <Card.Body gap="4" p="6">
                      <Box boxSize="10" rounded="md" bg="brand.50" borderWidth="1px" borderColor="brand.100" display="grid" placeItems="center">
                        <Icon as={f.icon} aria-hidden />
                      </Box>
                      <Stack gap="1" textAlign="left">
                        <Heading size="md">{f.title}</Heading>
                        <Text color="fg.muted">{f.desc}</Text>
                      </Stack>
                    </Card.Body>
                  </Card.Root>
                </MotionDiv>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Cómo funciona */}
      <Box as="section" py={{ base: 12, md: 16 }}>
        <Container maxW="7xl">
          <Stack gap="8" textAlign="center">
            <Heading size="xl">Cómo funciona</Heading>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={{ base: 6, md: 8 }}>
              {[
                { icon: LuUserCheck, title: "1. Seleccioná el test", desc: "Filtros por disciplina y categoría para llegar más rápido." },
                { icon: LuBrain, title: "2. Aplicá y revisá", desc: "Resultados al instante y notas clínicas; apoyo de IA." },
                { icon: LuFileDown, title: "3. Compartí el PDF", desc: "Listo para familias/escuelas; queda en el expediente." },
              ].map((s, i) => (
                <MotionDiv key={i} variants={slideUp} initial="hidden" whileInView="show" viewport={viewportOnce}>
                  <Card.Root h="full" borderWidth="1px" borderColor="blackAlpha.200">
                    <Card.Body p="6" gap="3">
                      <Icon as={s.icon} boxSize="7" aria-hidden />
                      <Heading size="md">{s.title}</Heading>
                      <Text color="fg.muted">{s.desc}</Text>
                    </Card.Body>
                  </Card.Root>
                </MotionDiv>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Módulos */}
      <Box as="section" py={{ base: 10, md: 16 }} bg="gray.50">
        <Container maxW="7xl">
          <Stack gap="10" textAlign="center">
            <Heading size="xl">Módulos clave</Heading>
            <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={{ base: 6, md: 8 }}>
              {[
                { icon: LuTabletSmartphone, title: "Aplicación de tests", desc: "Fluida en tablet o laptop." },
                { icon: LuFileDown, title: "Resultados + PDF", desc: "Claridad y trazabilidad profesional." },
                { icon: LuBrain, title: "Entrevista + IA", desc: "Hallazgos preliminares más rápido." },
                { icon: LuTrendingUp, title: "Panel de indicadores", desc: "Actividad semanal y uso por test." },
              ].map((m, i) => (
                <MotionDiv key={i} variants={fadeIn} initial="hidden" whileInView="show" viewport={viewportOnce}>
                  <Card.Root h="full" borderWidth="1px" borderColor="blackAlpha.200"
                             transition="transform .25s ease"
                             _hover={{ transform: "scale(1.02)" }}>
                    <Card.Body p="6" gap="3">
                      <Icon as={m.icon} boxSize="7" aria-hidden />
                      <Heading size="md">{m.title}</Heading>
                      <Text color="fg.muted">{m.desc}</Text>
                    </Card.Body>
                  </Card.Root>
                </MotionDiv>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Planes (ancla) */}
      <Box as="section" id="planes" py={{ base: 12, md: 16 }} bg="gray.50">
        <Container maxW="7xl">
          <Stack gap="8" textAlign="center">
            <Heading size="xl">Planes por uso — crece a tu ritmo</Heading>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={{ base: 6, md: 8 }}>
              {[
                { name: "Starter", points: ["X tests/mes", "Y entrevistas", "Z opiniones IA", "PDFs ilimitados"], cta: "Crear cuenta", to: "/signup" },
                { name: "Clínica", points: ["Todo lo del Starter", "Límites mayores", "Soporte priorizado"], cta: "Hablar por WhatsApp", to: "https://wa.me/###########" },
                { name: "Institucional", points: ["Múltiples usuarios", "Límites altos", "Acompañamiento"], cta: "Agendar demo", to: "https://wa.me/###########" },
              ].map((p, i) => (
                <MotionDiv key={i} variants={scaleIn} initial="hidden" whileInView="show" viewport={viewportOnce}>
                  <Card.Root borderWidth="1px" borderColor="blackAlpha.200" h="full">
                    <Card.Body p="6" gap="5">
                      <Heading size="lg">{p.name}</Heading>
                      <Stack as="ul" gap="2" textAlign="left">
                        {p.points.map((pt, j) => (
                          <Text as="li" key={j} color="fg.muted">• {pt}</Text>
                        ))}
                      </Stack>
                      <Button
                        colorPalette="brand"
                        variant={i === 0 ? "solid" : "outline"}
                        as={RouterLink}
                        to={p.to}
                        target={p.to.startsWith("http") ? "_blank" : undefined}
                      >
                        {p.cta}
                      </Button>
                    </Card.Body>
                  </Card.Root>
                </MotionDiv>
              ))}
            </Grid>
            <HStack justify="center" gap="4">
              <Link asChild><RouterLink to="/pricing">Ver detalle de precios →</RouterLink></Link>
              <Link asChild><RouterLink to="/pricing">Comparar planes →</RouterLink></Link>
            </HStack>
          </Stack>
        </Container>
      </Box>

      {/* CTA final */}
      <Box as="section" py={{ base: 12, md: 16 }} bg="brand.900" color="white">
        <Container maxW="7xl">
          <MotionDiv variants={fadeIn} initial="hidden" whileInView="show" viewport={viewportOnce}>
            <Flex direction={{ base: "column", md: "row" }} align="center" justify="space-between" gap="6">
              <Stack gap="2">
                <Heading size={{ base: "xl", md: "2xl" }}>¿Listo para empezar?</Heading>
                <Text color="whiteAlpha.800">Creá tu cuenta y configurá tu práctica en minutos.</Text>
              </Stack>
              <HStack gap="3" wrap="wrap">
                <Button colorPalette="brand" onClick={() => navigate("/signup")} rightIcon={<LuArrowRight />}>Crear cuenta</Button>
                <Link asChild color="whiteAlpha.900"><RouterLink to="/pricing">Planes y precios</RouterLink></Link>
              </HStack>
            </Flex>
          </MotionDiv>
        </Container>
      </Box>

      {/* Footer */}
      <Box as="footer" py="10" borderTopWidth="1px" bg="white">
        <Container maxW="7xl">
          <Flex direction={{ base: "column", md: "row" }} align="center" justify="space-between" gap="6">
            <HStack gap="3">
              <BrandLogo height="28px" />
              <Text color="fg.muted">© {new Date().getFullYear()} evaluacionpsicologica.org</Text>
            </HStack>
            <HStack gap="6" color="fg.muted">
              <Link asChild><RouterLink to="/login">Login</RouterLink></Link>
              <Link asChild><RouterLink to="/signup">Signup</RouterLink></Link>
              <Link asChild><RouterLink to="/pricing">Planes</RouterLink></Link>
              <Link asChild><RouterLink to="/privacy">Privacidad</RouterLink></Link>
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  )
}
