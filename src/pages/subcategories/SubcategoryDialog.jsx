import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Dialog, Portal, Button, Input, Textarea, VStack, HStack, Box, Text,
} from '@chakra-ui/react'

export default function SubcategoryDialog({ isOpen, onClose, onSubmit, initialValues, disciplines, categories }) {
  const isEdit = !!(initialValues && initialValues.id)

  const [disciplineId, setDisciplineId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const firstRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        const cat = categories?.find(c => c.id === initialValues.categoryId)
        setDisciplineId(cat ? String(cat.disciplineId) : '')
        setCategoryId(String(initialValues.categoryId || ''))
        setCode(initialValues.code || '')
        setName(initialValues.name || '')
        setDescription(initialValues.description || '')
        setIsActive(!!initialValues.isActive)
      } else {
        setDisciplineId('')
        setCategoryId('')
        setCode('')
        setName('')
        setDescription('')
        setIsActive(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEdit])

  const categoriesForDiscipline = useMemo(() => {
    if (!disciplineId) return categories || []
    return (categories || []).filter(c => String(c.disciplineId) === String(disciplineId))
  }, [categories, disciplineId])

  // Si se cambia la disciplina y la categoría ya no pertenece, limpiar la categoría
  useEffect(() => {
    const cat = categories?.find(c => String(c.id) === String(categoryId))
    if (cat && disciplineId && String(cat.disciplineId) !== String(disciplineId)) {
      setCategoryId('')
    }
  }, [disciplineId, categoryId, categories])

  async function handleSubmit() {
    if (!name.trim()) return
    if (!isEdit && (!code.trim() || !categoryId)) return

    setSaving(true)
    try {
      await onSubmit({
        id: isEdit ? initialValues.id : 0,
        categoryId: Number(categoryId),
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
              <Dialog.Title>{isEdit ? 'Editar subcategoría' : 'Nueva subcategoría'}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap="4" align="stretch">
                {/* Disciplina (solo para filtrar categorías; el backend solo necesita categoryId) */}
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

                {/* Categoría */}
                <Box>
                  <Text as="label" htmlFor="category" fontWeight="semibold" mb="1" display="block">
                    Categoría {isEdit ? '' : '*'}
                  </Text>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isEdit}
                    required={!isEdit}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', width: '100%' }}
                  >
                    <option value="">Selecciona…</option>
                    {categoriesForDiscipline.map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
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
                    placeholder="p.ej. INF"
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
                    placeholder="Subcategoría"
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
