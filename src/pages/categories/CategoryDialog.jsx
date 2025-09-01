import { useEffect, useRef, useState } from 'react'
import {
  Dialog, Portal, Button, Input, Textarea, VStack, HStack, Box, Text,
} from '@chakra-ui/react'

export default function CategoryDialog({ isOpen, onClose, onSubmit, initialValues, disciplines }) {
  const isEdit = !!(initialValues && initialValues.id)

  const [disciplineId, setDisciplineId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const firstRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setDisciplineId(String(initialValues.disciplineId || ''))
        setCode(initialValues.code || '')
        setName(initialValues.name || '')
        setDescription(initialValues.description || '')
        setIsActive(!!initialValues.isActive)
      } else {
        setDisciplineId('')
        setCode('')
        setName('')
        setDescription('')
        setIsActive(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit])

  async function handleSubmit() {
    if (!name.trim()) return
    if (!isEdit && (!code.trim() || !disciplineId)) return

    setSaving(true)
    try {
      await onSubmit({
        id: isEdit ? initialValues.id : 0,
        disciplineId: Number(disciplineId),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => { if (!e.open) onClose() }}
      placement="center"
      initialFocusEl={() => firstRef.current}
    >
      <Portal>
        <Dialog.Backdrop zIndex="modal" />
        <Dialog.Positioner zIndex="modal">
          <Dialog.Content maxW="lg">
            <Dialog.Header>
              <Dialog.Title>{isEdit ? 'Editar categoría' : 'Nueva categoría'}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap="4" align="stretch">
                {/* Disciplina */}
                <Box>
                  <Text as="label" htmlFor="discipline" fontWeight="semibold" mb="1" display="block">
                    Disciplina {isEdit ? '' : '*'}
                  </Text>
                  <select
                    id="discipline"
                    ref={firstRef}
                    value={disciplineId}
                    onChange={(e) => setDisciplineId(e.target.value)}
                    disabled={isEdit}
                    required={!isEdit}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', width: '100%' }}
                  >
                    <option value="">Selecciona…</option>
                    {disciplines?.map(d => (
                      <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                    ))}
                  </select>
                </Box>

                {/* Código */}
                <Box>
                  <Text as="label" htmlFor="code" fontWeight="semibold" mb="1" display="block">
                    Código {isEdit ? '' : '*'}
                  </Text>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="p.ej. CLIN"
                    disabled={isEdit}
                    required={!isEdit}
                  />
                </Box>

                {/* Nombre */}
                <Box>
                  <Text as="label" htmlFor="name" fontWeight="semibold" mb="1" display="block">
                    Nombre *
                  </Text>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Clínica infantil"
                    required
                  />
                </Box>

                {/* Descripción */}
                <Box>
                  <Text as="label" htmlFor="desc" fontWeight="semibold" mb="1" display="block">
                    Descripción
                  </Text>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Box>

                {/* Activa */}
                <HStack>
                  <input
                    id="active"
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <Text as="label" htmlFor="active">Activa</Text>
                </HStack>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose} mr={3}>Cancelar</Button>
              <Button colorPalette="blue" onClick={handleSubmit} loading={saving}>
                {isEdit ? 'Guardar' : 'Crear'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
