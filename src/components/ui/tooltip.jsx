// src/components/ui/tooltip.jsx
import { Tooltip } from '@chakra-ui/react'

/**
 * Tip: wrapper para Chakra v3 Tooltip (namespace).
 * Uso:
 *   <Tip content="Buscar"><IconButton ...>{...}</IconButton></Tip>
 *
 * Props útiles:
 * - content / label: texto del tooltip (content tiene prioridad)
 * - openDelay / closeDelay: tiempos en ms
 * - showArrow: muestra flecha (default: true)
 * - asChild: si true, usa el elemento hijo como trigger sin wrapper
 */
export function Tip({
  content,
  label,
  children,
  openDelay = 200,
  closeDelay = 80,
  showArrow = true,
  asChild = true,
  ...rest
}) {
  const text = content ?? label

  return (
    <Tooltip.Root openDelay={openDelay} closeDelay={closeDelay} {...rest}>
      <Tooltip.Trigger asChild={asChild}>
        {asChild ? (
          children
        ) : (
          <span style={{ display: 'inline-flex', lineHeight: 0 }}>{children}</span>
        )}
      </Tooltip.Trigger>

      <Tooltip.Positioner>
        <Tooltip.Content>
          {text}
          {showArrow ? <Tooltip.Arrow /> : null}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  )
}
