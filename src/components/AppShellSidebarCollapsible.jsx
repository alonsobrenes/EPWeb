import React, { useMemo, useState, useEffect, useReducer } from "react"
import {
  Box, Flex, HStack, VStack, IconButton, Button, Text,
  useBreakpointValue, Separator, Icon, Drawer, Avatar, Menu, Badge
} from "@chakra-ui/react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  LuMenu, LuLayoutDashboard, LuUsers, LuFileText, LuSettings,
  LuChevronDown, LuChevronRight, LuFolderTree, LuUser, LuLogOut, LuClipboardList
} from "react-icons/lu"
import BrandLogo from "./BrandLogo"
import { useAuth } from "../auth/AuthProvider"
import { ROLES } from "../auth/roles"
import { getCurrentUser, hasRole } from "../auth/session"
import client, { apiOrigin } from "../api/client"

const PROFILE_ROLES = [ROLES.EDITOR]

const topLinks = [
  { to: "/app", label: "Dashboard", icon: LuLayoutDashboard, end: true },
]

const groups = [
  {
    id: "gestion",
    title: "Gestión",
    roles: [ROLES.ADMIN],
    items: [
      { to: "/app/disciplines",   label: "Disciplinas",    icon: LuFolderTree },
      { to: "/app/categories",    label: "Categorías",     icon: LuFolderTree },
      { to: "/app/subcategories", label: "Subcategorías",  icon: LuFolderTree },
      { to: "/app/tests",         label: "Evaluaciones",   icon: LuFileText },
    ],
  },
  {
    id: "clinica",
    title: "Clínica",
    roles: [ROLES.EDITOR, ROLES.ADMIN],
    items: [
      { to: "/app/clinic/pacientes",     label: "Pacientes",     icon: LuUsers },
      { to: "/app/clinic/entrevista",     label: "Primera Entrevista",     icon: LuUsers },
      { to: "/app/clinic/evaluaciones",  label: "Evaluaciones",  icon: LuClipboardList },
    ],
  },
  {
    id: "ajustes",
    title: "Ajustes",
    roles: [],
    items: [{ to: "/app/ajustes", label: "Preferencias", icon: LuSettings }],
  },
]

function decodeJwtPayload() {
  try {
    const keys = ["authToken", "token"];
    let raw = null;
    for (const k of keys) {
      raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) break;
    }
    if (!raw) return {};
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
    const [, payload] = token.split(".");
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch { return {}; }
}


function deriveEmailFromPayload(p) {
  return (
    p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    p.email ||
    p.preferred_username ||
    null
  );
}
function deriveRoleFromPayload(p) {
  return (
    p["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    p.role ||
    null
  );
}


function getUidFromUser(user) {
  return (
    user?.email ||
    user?.raw?.email ||
    user?.raw?.sub ||
    user?.raw?.nameidentifier || // WS-Fed / SAML
    user?.id ||
    user?.userId ||
    user?.raw?.preferred_username ||
    null
  )
}

function readProfileCache(uid) {
  try {
    const s = localStorage.getItem(`ep:profile:${uid}`);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function readAvatarCache(uid) {
  try {
    if (uid) {
      const a = localStorage.getItem(`ep:avatarUrl:${uid}`)
      if (a) return a
    }
    // fallback por si tu flujo viejo guardó en clave global
    return localStorage.getItem('ep:avatarUrl') || ""
  } catch { return "" }
}

function writeProfileCache(uid, payload) {
  localStorage.setItem(`ep:profile:${uid}`, JSON.stringify(payload));
  if (payload?.avatarUrl) {
    localStorage.setItem(`ep:avatarUrl:${uid}`, payload.avatarUrl);
  }
  window.dispatchEvent(new Event("ep:profile-updated"));
}

function deriveInitials(nameOrEmail) {
  const s = (nameOrEmail || "").trim()
  if (!s) return "U"
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (s.includes("@")) return s[0].toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

function deriveUid() {
  const p = decodeJwtPayload();
  const email = deriveEmailFromPayload(p);
  const id =
    p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
    p.sub ||
    p.nameid ||
    p.uid ||
    null;
  return (email || id || "").toString().toLowerCase();
}

function absUrl(u) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  const base = import.meta.env?.VITE_API_BASE || window.location.origin;
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}


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
        px="2" py="1.5" rounded="md" cursor="pointer"
        onClick={() => setOpen(s => !s)}
        _hover={{ bg: "blackAlpha.50" }}
      >
        <Icon as={open ? LuChevronDown : LuChevronRight} />
        <Text fontWeight="semibold">{title}</Text>
      </HStack>
      <Box display="grid" gridTemplateRows={open ? "1fr" : "0fr"} transition="grid-template-rows 200ms ease" mt="2" pl="2">
        <Box overflow="hidden">
          <VStack align="stretch" gap="1">
            {items.map(l => <SidebarLink key={l.to} {...l} onNavigate={onNavigate} />)}
          </VStack>
        </Box>
      </Box>
    </Box>
  )
}

/** Unificado: usa email como UID (cache consistente entre Perfil y Sidebar) */
function deriveDisplay(currentUser) {
  const payload = decodeJwtPayload()
  const email =
    (currentUser?.email || deriveEmailFromPayload(payload) || "").toLowerCase()
  const uid =
    email ||
    String(
      currentUser?.id ||
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
        payload.sub ||
        ""
    ).toLowerCase()

  const cached = uid ? readProfileCache(uid) : null
  const cachedAvatar = uid ? readAvatarCache(uid) : ""

  const name =
    (cached?.name ||
      currentUser?.name ||
      (email ? email.split("@")[0] : "") ||
      "").trim()

  const role = currentUser?.role || deriveRoleFromPayload(payload) || ""

  const avatarUrl = absUrl(
    cachedAvatar || cached?.avatarUrl || currentUser?.avatarUrl || ""
  )

  const displayName = name || email || "Usuario"

  return {
    name: displayName,
    email,
    role,
    avatarUrl,
    initials: deriveInitials(displayName),
  }
}


function UserCard({ currentUser, onLogout, onNavigateProfile }) {
  const { name, email, initials, role, avatarUrl } = deriveDisplay(currentUser)
  return (
    <HStack p="3" borderWidth="1px" rounded="lg" justify="space-between" align="center" bg="white">
      <HStack gap="3" minW={0}>
        <Avatar.Root size="sm">
          {avatarUrl ? <Avatar.Image src={avatarUrl} alt="Avatar" /> : null}
          <Avatar.Fallback>{initials}</Avatar.Fallback>
        </Avatar.Root>
        <Box minW={0} flex="1" overflow="hidden">
          <HStack gap="2">
            <Text fontWeight="semibold" maxW="160px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{name}</Text>
            {role && <Badge size="sm" variant="subtle">{role}</Badge>}
          </HStack>
          {email && <Text color="fg.muted" fontSize="sm" maxW="180px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{email}</Text>}
        </Box>
      </HStack>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton variant="ghost" aria-label="Más acciones" size="xs" icon={<LuMenu />} />
        </Menu.Trigger>
        <Menu.Content
          bg="white"
          _dark={{ bg: "gray.800" }}
          shadow="lg"
          borderWidth="1px"
          borderColor="blackAlpha.300"
          rounded="md"
          minW="sm"
        >
          <Menu.Item onClick={onNavigateProfile}><HStack gap="2"><Icon as={LuUser} /><Text>Perfil</Text></HStack></Menu.Item>
          <Menu.Item onClick={onLogout}><HStack gap="2"><Icon as={LuLogOut} /><Text>Cerrar sesión</Text></HStack></Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </HStack>
  )
}

function SidebarContent({ onNavigate, onLogout, currentUser, onNavigateProfile }) {
  const location = useLocation()
  const visibleGroups = useMemo(() => {
    const user = currentUser
    const isGroupAllowed = (g) => !g.roles || g.roles.length === 0 || hasRole(user, g.roles)
    const isItemAllowed = (gRoles, it) => {
      const roles = it.roles && it.roles.length > 0 ? it.roles : gRoles
      return !roles || roles.length === 0 || hasRole(user, roles)
    }
    return groups
      .filter(isGroupAllowed)
      .map(g => ({ ...g, items: g.items.filter(it => isItemAllowed(g.roles || [], it)) }))
      .filter(g => g.items.length > 0)
  }, [currentUser])

  const defaultOpenById = useMemo(() => {
    const map = {}
    for (const g of visibleGroups) map[g.id] = g.items.some(it => location.pathname.startsWith(it.to))
    return map
  }, [location.pathname, visibleGroups])

  const showProfileCard = useMemo(() => hasRole(currentUser, [ROLES.EDITOR]), [currentUser])

  return (
    <Flex direction="column" h="100%" p="4" gap="3">
      <HStack justify="center" py="2"><BrandLogo height="40px" /></HStack>
      <VStack align="stretch" gap="1" mt="2">
        {topLinks.map(l => <SidebarLink key={l.to} {...l} onNavigate={onNavigate} />)}
      </VStack>
      <Separator my="3" />
      <VStack align="stretch" gap="3" flex="1">
        {visibleGroups.map(g => (
          <NavGroup key={g.id} id={g.id} title={g.title} items={g.items} defaultOpen={defaultOpenById[g.id]} onNavigate={onNavigate} />
        ))}
      </VStack>
      {showProfileCard ? (
        <UserCard currentUser={currentUser} onLogout={onLogout} onNavigateProfile={onNavigateProfile} />
      ) : (
        <Button w="full" variant="outline" colorPalette="brand" onClick={onLogout} leftIcon={<LuLogOut />}>Logout</Button>
      )}
    </Flex>
  )
}

export default function AppShellSidebarCollapsible() {
  const [profile, setProfile] = useState({ name: "", email: "", avatarUrl: "" });
  const [open, setOpen] = useState(false)
  const isDesktop = useBreakpointValue({ base: false, lg: true })
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const uid = deriveUid();
    if (!uid) return; // sin token aún

    const cached = readProfileCache(uid);
    const avatarFromCache =
      localStorage.getItem(`ep:avatarUrl:${uid}`) || cached?.avatarUrl || "";

    // 1) Primer render: usa cache si existe
    if (cached?.email || avatarFromCache) {
      setProfile({
        name: cached?.name || (cached?.email ? cached.email.split("@")[0] : ""),
        email: cached?.email || "",
        avatarUrl: absUrl(avatarFromCache),
      });
    }
    // 2) Si falta email o avatar, consulta /users/me una sola vez
    const needFetch = !(cached?.email) || !(avatarFromCache);
    if (needFetch) {
      client
        .get("/users/me")
        .then(({ data }) => {
          const email = data?.email || cached?.email || deriveEmailFromPayload(decodeJwtPayload()) || "";
          const name =
            data?.name ||
            cached?.name ||
            (email ? email.split("@")[0] : "Usuario");
          const avatarUrl = absUrl(data?.avatarUrl || avatarFromCache || "");
          const payload = { name, email, avatarUrl };
          writeProfileCache(uid, payload);
          setProfile(payload);
        })
        .catch(() => {
          // último recurso: solo desde JWT
          const email = deriveEmailFromPayload(decodeJwtPayload()) || "";
          setProfile((p) => ({
            ...p,
            email,
            name: p.name || (email ? email.split("@")[0] : "Usuario"),
          }));
        });
    }
    // 3) Escucha actualizaciones desde la página de Perfil
    const onUpdated = () => {
      const fresh = readProfileCache(uid);
      const avatar = localStorage.getItem(`ep:avatarUrl:${uid}`) || fresh?.avatarUrl || "";
      setProfile({
        name: fresh?.name || (fresh?.email ? fresh.email.split("@")[0] : ""),
        email: fresh?.email || "",
        avatarUrl: absUrl(avatar),
      });
    };
    window.addEventListener("ep:profile-updated", onUpdated);
    return () => window.removeEventListener("ep:profile-updated", onUpdated);
  }, []);
  useEffect(() => {
    const h = () => forceUpdate()
    window.addEventListener("ep:profile-updated", h)
    return () => window.removeEventListener("ep:profile-updated", h)
  }, [])
  const { logout, user: authUser } = useAuth()
  const user = authUser ?? getCurrentUser()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate("/login", { replace: true }) }
  const goProfile = () => navigate("/app/perfil")
  return (
    <Flex h="100svh" overflow="hidden">
      {isDesktop && (
        <Box w="280px" borderRightWidth="1px" bg="white">
          <SidebarContent onNavigate={() => {}} onLogout={handleLogout} onNavigateProfile={goProfile} currentUser={user} />
        </Box>
      )}
      {!isDesktop && (
        <Drawer.Root open={open} onOpenChange={(e) => setOpen(!!e.open)} placement="start">
          <Drawer.Backdrop bg="blackAlpha.400" backdropFilter="blur(1px)"/>
          <Drawer.Positioner zIndex="modal">
            <Drawer.Content
               bg="white"                // <- fondo SOLIDO (igual que en PatientDialog)
              _dark={{ bg: "gray.800" }}// <- modo oscuro equivalente
              shadow="2xl"
              borderRightWidth="1px"
              borderColor="blackAlpha.300"
              maxW="18rem"              // o el ancho que uses para el sidebar
              h="100dvh"
              display="flex"
              flexDirection="column"
            >
              <Drawer.Header borderBottomWidth="1px"><BrandLogo height="32px" /></Drawer.Header>
              <Drawer.Body p="0">
                <SidebarContent onNavigate={() => setOpen(false)} onLogout={handleLogout} onNavigateProfile={() => { setOpen(false); goProfile() }} currentUser={user} />
              </Drawer.Body>
              <Drawer.CloseTrigger />
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      )}
      <Flex direction="column" flex="1" minW={0}>
        <HStack as="header" px="4" py="3" borderBottomWidth="1px" bg="white" justify="space-between" position="sticky" top="0" zIndex="docked">
          {!isDesktop && <IconButton variant="ghost" aria-label="Abrir menú" onClick={() => setOpen(true)} icon={<LuMenu />} />}
          <Text fontWeight="semibold">Evaluación Psicológica Integral</Text>
          <Box />
        </HStack>
        <Box as="main" p={{ base: 4, md: 6 }} overflow="auto">
          <Outlet />
        </Box>
      </Flex>
    </Flex>
  )
}
