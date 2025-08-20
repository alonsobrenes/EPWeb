// src/components/AppShellSidebarCollapsible.jsx
import React, { useMemo, useState } from "react"
import {
  Box,
  Flex,
  HStack,
  VStack,
  IconButton,
  Button,
  Text,
  useBreakpointValue,
  Separator,   // v3: reemplaza a Divider
  Icon,
  Drawer,      // v3: namespace de Drawer compuesto
} from "@chakra-ui/react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  LuMenu,
  LuLayoutDashboard,
  LuUsers,
  LuFileText,
  LuTrendingUp,
  LuSettings,
  LuChevronDown,
  LuChevronRight,
  LuLogOut,
  LuFolderTree,
} from "react-icons/lu"
import BrandLogo from "./BrandLogo"
import { useAuth } from "../auth/AuthProvider"

const topLinks = [
  { to: "/app", label: "Dashboard", icon: LuLayoutDashboard, end: true },
]

const groups = [
  {
    id: "gestion",
    title: "Gestión",
    items: [
      { to: "/app/disciplines",  label: "Disciplinas",   icon: LuFolderTree },
      { to: "/app/categories",   label: "Categorías",    icon: LuFolderTree },
      { to: "/app/subcategories",label: "Subcategorías", icon: LuFolderTree },
      { to: "/app/pacientes",    label: "Pacientes",     icon: LuUsers },
      { to: "/app/evaluaciones", label: "Evaluaciones",  icon: LuFileText },
      { to: "/app/reportes",     label: "Reportes",      icon: LuTrendingUp },
    ],
  },
  {
    id: "ajustes",
    title: "Ajustes",
    items: [{ to: "/app/ajustes", label: "Preferencias", icon: LuSettings }],
  },
]

function SidebarLink({ to, label, icon: IconComp, end, onNavigate }) {
  const location = useLocation()
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <Box
      as={NavLink}
      to={to}
      onClick={onNavigate}
      rounded="lg"
      px="3"
      py="2.5"
      display="flex"
      alignItems="center"
      gap="3"
      bg={isActive ? "brand.50" : "transparent"}
      borderWidth={isActive ? "1px" : "0"}
      borderColor={isActive ? "brand.100" : "transparent"}
      color={isActive ? "brand.700" : "fg.default"}
      _hover={{ bg: "blackAlpha.50" }}
    >
      <Icon as={IconComp} />
      <Text>{label}</Text>
    </Box>
  )
}

function NavGroup({ id, title, items, defaultOpen, onNavigate }) {
  const [open, setOpen] = useState(!!defaultOpen)

  return (
    <Box>
      <HStack
        px="2"
        py="1.5"
        rounded="md"
        cursor="pointer"
        onClick={() => setOpen((s) => !s)}
        _hover={{ bg: "blackAlpha.50" }}
      >
        <Icon as={open ? LuChevronDown : LuChevronRight} />
        <Text fontWeight="semibold">{title}</Text>
      </HStack>

      {/* Colapso suave sin <Collapse/> (compatible Chakra v3) */}
      <Box
        display="grid"
        gridTemplateRows={open ? "1fr" : "0fr"}
        transition="grid-template-rows 200ms ease"
        mt="2"
        pl="2"
      >
        <Box overflow="hidden">
          <VStack align="stretch" gap="1">
            {items.map((l) => (
              <SidebarLink key={l.to} {...l} onNavigate={onNavigate} />
            ))}
          </VStack>
        </Box>
      </Box>
    </Box>
  )
}

function SidebarContent({ onNavigate, onLogout }) {
  const location = useLocation()

  // Abre por defecto el grupo que contenga la ruta actual
  const defaultOpenById = useMemo(() => {
    const map = {}
    for (const g of groups) {
      map[g.id] = g.items.some((it) => location.pathname.startsWith(it.to))
    }
    return map
  }, [location.pathname])

  return (
    <Flex direction="column" h="100%" p="4" gap="3">
      <HStack justify="center" py="2">
        <BrandLogo height="40px" />
      </HStack>

      {/* Links superiores */}
      <VStack align="stretch" gap="1" mt="2">
        {topLinks.map((l) => (
          <SidebarLink key={l.to} {...l} onNavigate={onNavigate} />
        ))}
      </VStack>

      <Separator my="3" />

      {/* Grupos colapsables */}
      <VStack align="stretch" gap="3" flex="1">
        {groups.map((g) => (
          <NavGroup
            key={g.id}
            id={g.id}
            title={g.title}
            items={g.items}
            defaultOpen={defaultOpenById[g.id]}
            onNavigate={onNavigate}
          />
        ))}
      </VStack>

      <Button
        w="full"
        variant="outline"
        colorPalette="brand"
        onClick={onLogout}
        leftIcon={<LuLogOut />}
      >
        Logout
      </Button>
    </Flex>
  )
}

export default function AppShellSidebarCollapsible() {
  const [open, setOpen] = useState(false)
  const isDesktop = useBreakpointValue({ base: false, lg: true })
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <Flex h="100svh" overflow="hidden">
      {/* Sidebar desktop */}
      {isDesktop && (
        <Box w="280px" borderRightWidth="1px" bg="white">
          <SidebarContent onNavigate={() => {}} onLogout={handleLogout} />
        </Box>
      )}

      {/* Drawer móvil (patrón v3) */}
      {!isDesktop && (
        <Drawer.Root
          open={open}
          onOpenChange={(e) => setOpen(!!e.open)}
          placement="start" // izquierda
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header borderBottomWidth="1px">
                <BrandLogo height="32px" />
              </Drawer.Header>
              <Drawer.Body p="0">
                <SidebarContent onNavigate={() => setOpen(false)} onLogout={handleLogout} />
              </Drawer.Body>
              <Drawer.CloseTrigger />
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      )}

      {/* Área de contenido */}
      <Flex direction="column" flex="1" minW={0}>
        {/* Topbar */}
        <HStack
          as="header"
          px="4"
          py="3"
          borderBottomWidth="1px"
          bg="white"
          justify="space-between"
          position="sticky"
          top="0"
          zIndex="docked"
        >
          {!isDesktop && (
            <IconButton
              variant="ghost"
              aria-label="Abrir menú"
              onClick={() => setOpen(true)}
              icon={<LuMenu />}
            />
          )}
          <Text fontWeight="semibold">Evaluación Psicológica Integral</Text>
          <Box /> {/* spacer */}
        </HStack>

        {/* Página */}
        <Box as="main" p={{ base: 4, md: 6 }} overflow="auto">
          <Outlet />
        </Box>
      </Flex>
    </Flex>
  )
}
