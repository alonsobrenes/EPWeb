// src/app/profile/UserSettings.jsx
import { useEffect, useState } from "react"
import {
  Card, HStack, VStack, Text, Button, Badge, Input
} from "@chakra-ui/react"
import { ProfileApi } from "../../api/profileApi"
import { toaster } from "../../components/ui/toaster"

export default function UserSettings() {
  const [labels, setLabels] = useState([])
  const [lblLoading, setLblLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ code: '', name: '', colorHex: '#1E88E5' })

  async function loadLabels() {
    setLblLoading(true)
    try {
      const data = await ProfileApi.getLabels()
      setLabels(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      toaster.error({ title: 'No se pudieron cargar las etiquetas', description: e?.message || 'Error' })
    } finally {
      setLblLoading(false)
    }
  }

  useEffect(() => { loadLabels() }, [])

  async function onCreateLabel() {
    if (!form.code || !/^[a-z0-9_-]{1,64}$/i.test(form.code)) {
      toaster.error({ title: 'Code inválido', description: 'Usa slug sin espacios' }); return
    }
    if (!form.name || form.name.length > 128) {
      toaster.error({ title: 'Nombre inválido' }); return
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(form.colorHex || '')) {
      toaster.error({ title: 'Color inválido (#RRGGBB)' }); return
    }
    try {
      setCreating(true)
      await ProfileApi.createLabel({
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        colorHex: form.colorHex.toUpperCase(),
        isSystem: false
      })
      setForm({ code: '', name: '', colorHex: '#1E88E5' })
      await loadLabels()
      toaster.success({ title: 'Etiqueta creada' })
    } catch (e) {
      toaster.error({ title: 'No se pudo crear', description: e?.response?.data?.message || e?.message || 'Error' })
    } finally {
      setCreating(false)
    }
  }

  function startEdit(lbl) {
    setEditingId(lbl.id)
    setForm({ code: lbl.code, name: lbl.name, colorHex: lbl.colorHex })
  }

  async function onSaveEdit() {
    if (editingId == null) return
    try {
      await ProfileApi.updateLabel(editingId, {
        name: form.name.trim(),
        colorHex: form.colorHex.toUpperCase()
      })
      setEditingId(null)
      setForm({ code: '', name: '', colorHex: '#1E88E5' })
      await loadLabels()
      toaster.success({ title: 'Etiqueta actualizada' })
    } catch (e) {
      toaster.error({ title: 'No se pudo actualizar', description: e?.response?.data?.message || e?.message || 'Error' })
    }
  }
  function cancelEdit() {
    setEditingId(null)
    setForm({ code: '', name: '', colorHex: '#1E88E5' })
  }

  async function onDeleteLabel(id) {
    try {
      await ProfileApi.deleteLabel(id)
      await loadLabels()
      toaster.success({ title: 'Etiqueta eliminada' })
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Error'
      toaster.error({ title: 'No se pudo eliminar', description: msg })
    }
  }

  return (
    <Card.Root p="4" mt="6">
      <HStack justify="space-between" mb="2">
        <Text fontWeight="medium">Etiquetas (organización)</Text>
        <Button size="sm" onClick={loadLabels} isLoading={lblLoading}>Refrescar</Button>
      </HStack>

      {/* Formulario crear / editar */}
      <VStack align="stretch" gap="2" mb="3">
        <HStack>
          <Input placeholder="code (slug)" value={form.code} isDisabled={editingId !== null}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          <Input placeholder="Nombre" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input type="color" value={form.colorHex || '#000000'}
            onChange={e => setForm(f => ({ ...f, colorHex: e.target.value.toUpperCase() }))}
            width="60px" p="0" border="none" cursor="pointer" aria-label="Elegir color"  />
          {/* <Input placeholder="#RRGGBB" value={form.colorHex}
                onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))} width="120px" /> */}
          {editingId === null ? (
            <Button onClick={onCreateLabel} isLoading={creating}>Crear</Button>
          ) : (
            <>
              <Button onClick={onSaveEdit}>Guardar</Button>
              <Button variant="outline" onClick={cancelEdit}>Cancelar</Button>
            </>
          )}
        </HStack>
      </VStack>

      {/* Lista */}
      {labels.map(lbl => (
        <HStack key={lbl.id} justify="space-between" borderWidth="1px" borderRadius="md" p="2">
          <HStack>
            <div style={{
              width: 14, height: 14, borderRadius: 4,
              background: lbl.colorHex, border: '1px solid #ddd'
            }} />
            <Text><b>{lbl.code}</b> — {lbl.name}</Text>
            {lbl.isSystem && <Badge>system</Badge>}
          </HStack>

          {/* ⬇⬇ si es system, no mostramos acciones */}
          {lbl.isSystem ? null : (
            <HStack>
              <Button size="xs" onClick={() => startEdit(lbl)}>Editar</Button>
              <Button size="xs" variant="outline" colorScheme="red"
                onClick={() => onDeleteLabel(lbl.id)}>
                Eliminar
              </Button>
            </HStack>
          )}
        </HStack>
      ))}
    </Card.Root>
  )
}
