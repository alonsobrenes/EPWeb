import { useEffect, useRef, useState } from 'react'
import {
  Dialog, Portal, Button, HStack, Input, Textarea, Separator, Checkbox
} from '@chakra-ui/react'

function field(v) { return v ?? '' }

export default function QuestionDialog({
  isOpen,
  onClose,
  onSubmit,
  initialValues, // undefined = create
}) {
  const cancelBtnRef = useRef(null)
  const isEdit = Boolean(initialValues?.id)

  const [form, setForm] = useState({
    code: '',
    text: '',
    questionType: 'likert',
    orderNo: 0,
    isOptional: false,
  })

  useEffect(() => {
    if (isOpen) {
      setForm({
        code: field(initialValues?.code),
        text: field(initialValues?.text),
        questionType: field(initialValues?.questionType) || 'likert',
        orderNo: Number(initialValues?.orderNo ?? 0),
        isOptional: !!initialValues?.isOptional,
      })
    }
  }, [isOpen, initialValues])

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    if (!isEdit && !form.code.trim()) return
    if (!form.text.trim()) return
    onSubmit({
      ...(isEdit ? {} : { code: form.code }),
      text: form.text,
      questionType: form.questionType,
      orderNo: Number(form.orderNo || 0),
      isOptional: !!form.isOptional,
      id: initialValues?.id,
    })
  }

  return (
    <Dialog.Root
      role="dialog"
      open={isOpen}
      onOpenChange={(e) => !e.open && onClose?.()}
      initialFocusEl={() => cancelBtnRef.current}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content as="form" onSubmit={handleSubmit} maxW="720px">
            <Dialog.Header>
              <Dialog.Title>{isEdit ? 'Editar pregunta' : 'Nueva pregunta'}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>

              {!isEdit && (
                <>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Código</label>
                  <Input
                    value={form.code}
                    onChange={(e) => setField('code', e.target.value)}
                    maxLength={50}
                    placeholder="p.ej. P01"
                  />
                  <Separator my="3" />
                </>
              )}

              <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Texto</label>
              <Textarea
                value={form.text}
                onChange={(e) => setField('text', e.target.value)}
                rows={3}
              />
              <Separator my="3" />

              <HStack gap="3" align="flex-start">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Tipo</label>
                  <select
                    value={form.questionType}
                    onChange={(e) => setField('questionType', e.target.value)}
                    aria-label="Tipo de pregunta"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', fontSize: 14 }}
                  >
                    <option value="likert">Likert (1–4)</option>
                    <option value="boolean">Sí/No</option>
                    <option value="open_ended">Abierta</option>
                  </select>
                </div>

                <div style={{ width: 160 }}>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Orden</label>
                  <Input
                    type="number"
                    value={form.orderNo}
                    onChange={(e) => setField('orderNo', e.target.value)}
                    min={0}
                  />
                </div>
              </HStack>

              <Separator my="3" />

              <Checkbox.Root
                checked={!!form.isOptional}
                onCheckedChange={(e) => setField('isOptional', !!e.checked)}
              >
                <Checkbox.Control />
                <Checkbox.Label>Opcional</Checkbox.Label>
              </Checkbox.Root>
            </Dialog.Body>

            <Dialog.Footer>
              <Button ref={cancelBtnRef} onClick={onClose}>Cancelar</Button>
              <Button type="submit" ml={3} colorPalette="blue">
                {isEdit ? 'Guardar cambios' : 'Crear'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
