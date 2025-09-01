// src/app/disciplines/DisciplineDialog.jsx
import { useEffect, useRef, useState } from 'react'
import {
  Dialog, Portal, Button, Input, Textarea, VStack, HStack, Box, Text,
} from '@chakra-ui/react'

export default function DisciplineDialog({ isOpen, onClose, onSubmit, initialValues }) {
  const isEdit = !!(initialValues && initialValues.id)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setCode(initialValues.code || '')
        setName(initialValues.name || '')
        setDescription(initialValues.description || '')
        setIsActive(!!initialValues.isActive)
      } else {
        setCode('')
        setName('')
        setDescription('')
        setIsActive(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit])

  async function handleSubmit() {
    if (!name.trim() || (!isEdit && !code.trim())) return
    setSaving(true)
    try {
      await onSubmit({
        id: isEdit ? initialValues.id : 0,
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
      initialFocusEl={() => firstFieldRef.current}
    >
      <Portal>
        <Dialog.Backdrop zIndex="modal" />
        <Dialog.Positioner zIndex="modal">
          <Dialog.Content maxW="lg">
            <Dialog.Header>
              <Dialog.Title>{isEdit ? 'Editar disciplina' : 'Nueva disciplina'}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap="4" align="stretch">

                {/* Código */}
                <Box>
                  <Text as="label" htmlFor="code" fontWeight="semibold" mb="1" display="block">
                    Código{!isEdit ? ' *' : ''}
                  </Text>
                  <Input
                    id="code"
                    ref={firstFieldRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="p.ej. EDU"
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
                    placeholder="Educativa"
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
