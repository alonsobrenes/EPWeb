// src/components/UserAvatar.jsx
import { useMemo, useState } from "react"
import { Avatar, Box } from "@chakra-ui/react"
import { absolutizeApiUrl } from "../utils/url"

/**
 * user: {
 *   id: number|string,
 *   firstName?: string,
 *   lastName1?: string,
 *   email?: string,
 *   avatarUrl?: string,      // e.g. "/uploads/avatars/123.jpg"
 *   updatedAt?: string       // ISO (opcional, usado para cache-busting)
 * }
 */
export default function UserAvatar({ user, size = "md", ring = true }) {
  const [broken, setBroken] = useState(false)
  const src = useMemo(() => {    
    if (!user?.avatarUrl || broken) return undefined
    const base = absolutizeApiUrl(user?.avatarUrl || '/uploads/avatars/default.png')
    // Si hay updatedAt lo usamos como versión; si no, un token estable por sesión.
    const version = user.updatedAt || window.__AVATAR_VER__ || (window.__AVATAR_VER__ = Date.now().toString(36))
    const sep = base.includes("?") ? "&" : "?"
    return `${base}${sep}v=${encodeURIComponent(version)}`
  }, [user?.avatarUrl, user?.updatedAt, broken])

  const name = [user?.firstName, user?.lastName1].filter(Boolean).join(" ") || user?.email || "Usuario"

  return (
    <Box position="relative" lineHeight={0}>
      <Avatar
        key={user?.id ?? "nouser"}         // fuerza remount cuando cambia de usuario
        name={name}
        src={src}
        size={size}
        onError={() => setBroken(true)}    // si falla, mostramos initials
      />
      {ring && (
        <Box
          pointerEvents="none"
          position="absolute"
          inset={-2}
          rounded="full"
          border="2px solid"
          borderColor="blackAlpha.200"
        />
      )}
    </Box>
  )
}
