// src/pages/Landing.jsx
import React from "react"
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
} from "@chakra-ui/react"
import { useNavigate, Link as RouterLink } from "react-router-dom"
import { LuSparkles, LuShieldCheck, LuTrendingUp, LuArrowRight } from "react-icons/lu"
import BrandLogo from "../components/BrandLogo"
import signupImage from "../assets/signup-rp.png"   // si prefieres la del login, cámbiala

function DeviceFrame({ src }) {
  return (
    <Box
      position="relative"
      w={{ base: "full", md: "560px" }}
      h={{ base: "300px", md: "380px" }}
      rounded="2xl"
      borderWidth="1px"
      borderColor="blackAlpha.200"
      bg="white"
      boxShadow="lg"
      overflow="hidden"
    >
      {/* Barra superior estilo “ventana” */}
      <HStack px="4" py="3" borderBottomWidth="1px" borderColor="blackAlpha.100" bg="gray.50">
        <Box boxSize="2.5" rounded="full" bg="red.300" />
        <Box boxSize="2.5" rounded="full" bg="yellow.300" />
        <Box boxSize="2.5" rounded="full" bg="green.300" />
        <Text textStyle="sm" color="fg.muted" ml="auto">
          preview.evaluacionpsicologica.org
        </Text>
      </HStack>

      {/* Contenido (screenshot/imagen) */}
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        position="absolute"
        inset="0"
        w="full"
        h="full"
        objectFit="cover"
      />
      {/* Gradiente sutil para que no “queme” */}
      <Box position="absolute" inset="0" bgGradient="linear(to-t, blackAlpha.100, transparent)" />
    </Box>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <Box bg="white">
      {/* Nav */}
      <Box as="header" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px">
        <Container maxW="7xl" py="4">
          <HStack justify="space-between">
            <HStack gap="4">
              <BrandLogo height={{ base: "36px", md: "42px" }} />
              <Text display={{ base: "none", md: "block" }} color="fg.muted">
                Evaluación Psicológica Integral
              </Text>
            </HStack>
            <HStack gap="3">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Iniciar sesión
              </Button>
              <Button colorPalette="brand" onClick={() => navigate("/signup")}>
                Comenzar gratis
              </Button>
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Hero */}
      <Box as="section" py={{ base: 12, md: 20 }}>
        <Container maxW="7xl">
          <Flex gap={{ base: 10, lg: 16 }} direction={{ base: "column", lg: "row" }} align="center">
            <Stack flex="1" gap="6" textAlign={{ base: "center", lg: "left" }}>
              <Heading size={{ base: "3xl", md: "4xl" }} lineHeight="1.1">
                Evaluaciones claras,
                <br />
                decisiones con confianza.
              </Heading>
              <Text fontSize={{ base: "lg", md: "xl" }} color="fg.muted">
                Plataforma moderna para gestionar evaluaciones, reportes y seguimiento clínico.
                Registro en minutos, enfoque humano—impulsado por diseño simple y seguro.
              </Text>
              <HStack justify={{ base: "center", lg: "flex-start" }} gap="3" wrap="wrap">
                <Button size="lg" colorPalette="brand" onClick={() => navigate("/signup")}>
                  Crear cuenta
                </Button>
                <Button size="lg" variant="outline" colorPalette="brand" onClick={() => navigate("/login")}>
                  Ya tengo cuenta
                </Button>
              </HStack>
              <HStack justify={{ base: "center", lg: "flex-start" }} color="fg.muted">
                <Icon as={LuShieldCheck} />
                <Text textStyle="sm">Datos protegidos y cifrados</Text>
              </HStack>
            </Stack>

            <Box flex="1" display="flex" justifyContent={{ base: "center", lg: "flex-end" }}>
              <DeviceFrame src={signupImage} />
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Features */}
      <Box as="section" py={{ base: 10, md: 16 }} bg="gray.50">
        <Container maxW="7xl">
          <Stack gap="10" textAlign="center">
            <Stack gap="2">
              <Heading size="xl">Todo lo que necesitas</Heading>
              <Text color="fg.muted">Sin complicaciones. Enfocado en tu práctica clínica.</Text>
            </Stack>

            <Grid
              templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
              gap={{ base: 6, md: 8 }}
              alignItems="stretch"
            >
              {[
                {
                  icon: LuSparkles,
                  title: "Onboarding en minutos",
                  desc: "Comienza a trabajar sin curva de aprendizaje. Interfaz clara y accesible.",
                },
                {
                  icon: LuShieldCheck,
                  title: "Seguridad primero",
                  desc: "Autenticación segura y buenas prácticas de protección de datos.",
                },
                {
                  icon: LuTrendingUp,
                  title: "Seguimiento & reportes",
                  desc: "Indicadores y resúmenes para que tomes decisiones informadas.",
                },
              ].map((f, i) => (
                <Card.Root key={i} h="full" borderWidth="1px" borderColor="blackAlpha.200">
                  <Card.Body gap="4" p="6">
                    <Box
                      boxSize="10"
                      rounded="md"
                      bg="brand.50"
                      borderWidth="1px"
                      borderColor="brand.100"
                      display="grid"
                      placeItems="center"
                    >
                      <Icon as={f.icon} />
                    </Box>
                    <Stack gap="1" textAlign="left">
                      <Heading size="md">{f.title}</Heading>
                      <Text color="fg.muted">{f.desc}</Text>
                    </Stack>
                  </Card.Body>
                </Card.Root>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Testimonial */}
      <Box as="section" py={{ base: 12, md: 16 }}>
        <Container maxW="4xl">
          <Card.Root borderWidth="1px" borderColor="blackAlpha.200">
            <Card.Body p={{ base: 6, md: 10 }} gap="6">
              <Text fontSize={{ base: "lg", md: "xl" }} lineHeight="tall">
                “La plataforma nos permitió organizar las evaluaciones y el seguimiento con claridad. Las familias
                agradecen la comunicación y nosotros ganamos tiempo clínico.”
              </Text>
              <HStack>
                <Avatar.Root>
                  <Avatar.Fallback />
                  <Avatar.Image src="https://i.pravatar.cc/300?u=dr-001" alt="" />
                </Avatar.Root>
                <Stack gap="0">
                  <Text fontWeight="semibold">Dra. M. González</Text>
                  <Text color="fg.muted" textStyle="sm">
                    Psicóloga clínica infantil
                  </Text>
                </Stack>
              </HStack>
            </Card.Body>
          </Card.Root>
        </Container>
      </Box>

      {/* CTA final */}
      <Box as="section" py={{ base: 12, md: 16 }} bg="brand.900" color="white">
        <Container maxW="7xl">
          <Flex
            direction={{ base: "column", md: "row" }}
            align="center"
            justify="space-between"
            gap="6"
            rounded="2xl"
          >
            <Stack gap="2">
              <Heading size={{ base: "xl", md: "2xl" }}>Empieza hoy</Heading>
              <Text color="whiteAlpha.800">
                Regístrate gratis y ten tu práctica lista en minutos.
              </Text>
            </Stack>
            <HStack gap="3" wrap="wrap">
              <Button colorPalette="brand" onClick={() => navigate("/signup")} rightIcon={<LuArrowRight />}>
                Crear cuenta
              </Button>
              <Link asChild variant="plain" color="whiteAlpha.900">
                <RouterLink to="/login">Iniciar sesión</RouterLink>
              </Link>
            </HStack>
          </Flex>
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
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  )
}
