// src/components/hashtags/EditableInterviewHashtags.jsx
import { useEffect, useMemo, useState } from "react"
import { Box, HStack, Input, Text, Wrap, WrapItem, Badge, Button, Spinner } from "@chakra-ui/react"
import { toaster } from "../../components/ui/toaster"
import HashtagsApi from "../../api/hashtagsApi"

const RX = /#?([\p{L}\p{N}_-]{2,64})/iu
const norm = (s) => {
    const m = RX.exec(String(s || "").trim())
  if (!m) return null
  return m[1].toLowerCase()
}

/**
 * Bloque de hashtags editables para una entrevista (targetType="interview").
 * - Carga inicial con HashtagsApi.getFor({ type:'interview', id })
 * - Persistencia idempotente con HashtagsApi.setFor({ type:'interview', id, tags })
 *
 * Props:
 *   interviewId: Guid de la entrevista (requerido para guardar)
 *   disabled: boolean (deshabilitar botones/inputs cuando hay busy externo)
 */
export default function EditableInterviewHashtags({ interviewId, disabled = false }) {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [input, setInput] = useState("")
  const anyBusy = useMemo(() => disabled || loading || saving, [disabled, loading, saving])

  useEffect(() => {
    if (!interviewId) { setTags([]); return }
    let alive = true
    ;(async() => {
      setLoading(true)
      try {
        const r = await HashtagsApi.getFor({ type: "interview", id: interviewId })
        const items = Array.isArray(r?.items) ? r.items : []
        if (alive) setTags(items.map(x => (x.tag || "").toString()).filter(Boolean))
      } catch {
        if (alive) setTags([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [interviewId])

  async function persist(next)
{
    if (!interviewId)
    {
        toaster.error({ title: "Guarda/crea la entrevista antes de gestionar hashtags." })
      return
    }
    setSaving(true)
    try
    {
        const unique = Array.from(new Set((next || []).filter(Boolean)))
      const r = await HashtagsApi.setFor({ type: "interview", id: interviewId, tags: unique })
      const items = Array.isArray(r?.items) ? r.items : []
      setTags(items.map(x => (x.tag || "").toString()))
      toaster.success({ title: "Hashtags actualizados" })
    }
    catch
    {
        toaster.error({ title: "No se pudieron guardar los hashtags" })
    }
    finally
    {
        setSaving(false)
    }
}

async function add()
{
    const t = norm(input)
    if (!t) return
    setInput("")
    await persist([...tags, t])
  }

async function remove(t)
{
    await persist(tags.filter(x => x !== t))
  }

  return (
    <Box mt = "12px" >
      < Text textStyle="sm" color="fg.muted" mb="1">Hashtags</Text>

      {loading || saving? (
        <HStack color = "fg.muted" fontSize="sm"><Spinner size = "sm" />< Text > Procesando…</Text></HStack>
      ) : tags.length === 0 ? (
        <>
          <HStack>
            <Input
              placeholder = "#ansiedad"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add() }}
              disabled={anyBusy}
            />
            <Button onClick = { add } disabled={anyBusy}>Añadir</Button>
          </HStack>
          <Text mt = "2" textStyle="xs" color="fg.muted">Formato: letras/números/_/- (2–64). Se guardan sin “#”.</Text>
        </>
      ) : (
        <>
          <Wrap spacing = "2" mb="2">
            {tags.map((t) => (
              <WrapItem key = { t }>
                <HStack borderWidth = "1px" rounded="full" px="2" py="1">
                  <Badge variant = "subtle" >#{t}</Badge>
                  < Button size="xs" variant="ghost" onClick={() => remove(t)} disabled={anyBusy}>✕</Button>
                </HStack>
              </WrapItem>
            ))}
          </Wrap>
          <HStack>
            <Input
              placeholder = "#ansiedad"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add() }}
              disabled={anyBusy}
            />
            <Button onClick = { add } disabled={anyBusy}>Añadir</Button>
          </HStack>
        </>
      )}
    </Box>
  )
}
