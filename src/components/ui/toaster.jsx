// src/components/ui/toaster.jsx
"use client"
import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

// Config global del toaster (ajústalo a tu gusto)
export const toaster = createToaster({
  placement: "top-end",     // "top", "top-end", "bottom-start", etc.
  pauseOnPageIdle: true,
  max: 3,
})

export function Toaster() {
  return (
    <Portal>
      {/* Inyecta el store 'toaster' aquí */}
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }}>
            {/* Indicador o spinner si el tipo es "loading" */}
            {toast.type === "loading" ? (
              <Spinner size="sm" />
            ) : (
              <Toast.Indicator />
            )}

            {/* Contenido */}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>

            {/* Acción opcional */}
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}

            {/* Botón de cerrar si lo habilitas con meta.closable */}
            {toast.meta?.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}