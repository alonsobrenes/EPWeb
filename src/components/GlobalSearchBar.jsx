// src/components/GlobalSearchBar.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, HStack, Input, Button, Text, VStack, Badge, Checkbox, Spinner
} from '@chakra-ui/react'
import SearchApi from '../api/searchApi'

const ALL_TYPES = [
  { key: 'patient',     label: 'Patients' },
  { key: 'interview',   label: 'Interviews' },
  { key: 'session',     label: 'Sessions' },
  { key: 'test',        label: 'Tests' },
  { key: 'attachment',  label: 'Attachments' },
]

function summarizeTypes(sel) {
  if (sel.size === 0 || sel.size === ALL_TYPES.length) return 'Todo'
  return [...sel].map(k => ALL_TYPES.find(t => t.key === k)?.label || k).join(', ')
}

export default function GlobalSearchBar({ defaultTypes = [], onSearch }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [q, setQ] = useState('')
  const [openTypes, setOpenTypes] = useState(false)
  const [selTypes, setSelTypes] = useState(() => {
    return new Set(
      Array.isArray(defaultTypes) && defaultTypes.length
        ? defaultTypes
        : ALL_TYPES.map(t => t.key)
    )
  })

  const [busy, setBusy] = useState(false)
  const [sug, setSug] = useState({ hashtags: [], labels: [], entities: [], durationMs: 0 })
  const [showSug, setShowSug] = useState(false)

  const inputRef = useRef(null)
  const debounceRef = useRef(0)
  const reqIdRef = useRef(0)
  const suppressSuggestRef = useRef(false)

  const runSoon = (fn) => {
    if (typeof queueMicrotask === 'function') queueMicrotask(fn)
    else setTimeout(fn, 0)
  }

  // cerrar sugerencias si otro componente lo pide
  useEffect(() => {
    const h = () => {
      suppressSuggestRef.current = true
      setShowSug(false)
      setSug({ hashtags: [], labels: [], entities: [], durationMs: 0 })
      reqIdRef.current++
    }
    window.addEventListener('global-search:close-suggest', h)
    return () => window.removeEventListener('global-search:close-suggest', h)
  }, [])

  // cerrar al cambiar de ruta
  useEffect(() => {
    suppressSuggestRef.current = true
    setShowSug(false)
    setSug({ hashtags: [], labels: [], entities: [], durationMs: 0 })
    reqIdRef.current++
  }, [location.key])

  // sugerencias con cancelación
  useEffect(() => {
    clearTimeout(debounceRef.current)

    if (suppressSuggestRef.current) {
      setShowSug(false)
      return
    }

    const qTrim = q.trim()
    if (qTrim.length < 2) {
      setSug({ hashtags: [], labels: [], entities: [], durationMs: 0 })
      setShowSug(false)
      return
    }

    debounceRef.current = window.setTimeout(async () => {
      const myId = ++reqIdRef.current
      try {
        setBusy(true)
        const data = await SearchApi.suggest(qTrim, 8)
        if (myId === reqIdRef.current && !suppressSuggestRef.current) {
          setSug(data || { hashtags: [], labels: [], entities: [], durationMs: 0 })
          setShowSug(true)
        }
      } catch {}
      finally {
        if (myId === reqIdRef.current) setBusy(false)
      }
    }, 200)

    return () => clearTimeout(debounceRef.current)
  }, [q])

  const handleChange = (e) => {
    suppressSuggestRef.current = false
    setQ(e.target.value)
  }

  // total de sugerencias (no lo renderizamos como número cuando es 0)
  const totalSuggest = useMemo(() => {
    const h = Array.isArray(sug?.hashtags) ? sug.hashtags.length : 0
    const l = Array.isArray(sug?.labels) ? sug.labels.length : 0
    const e = Array.isArray(sug?.entities) ? sug.entities.length : 0
    return h + l + e
  }, [sug])

  // navega a /app/search creando QS limpio
  const navigateToResults = ({ qText, types, etype, eid }) => {
    const sp = new URLSearchParams()
    if (qText && qText.trim()) sp.set('q', qText.trim())
    if (Array.isArray(types) && types.length > 0) {
      types.forEach(t => sp.append('type', t))
    }
    // marcadores especiales cuando viene de click en entidad
    if (etype) sp.set('etype', etype)
    if (eid) sp.set('eid', String(eid))

    sp.set('page', '1')
    navigate(`/app/search?${sp.toString()}`)
    onSearch?.({ q: qText?.trim() || '', types: types || [] })
  }

  function runSearch() {
    suppressSuggestRef.current = true
    setShowSug(false)
    setSug({ hashtags: [], labels: [], entities: [], durationMs: 0 })
    reqIdRef.current++
    inputRef.current?.blur()

    const selected = selTypes.size === ALL_TYPES.length ? [] : [...selTypes]
    const qText = q.trim()
    runSoon(() => navigateToResults({ qText, types: selected }))
  }

  // CLICK en sugerencia
  function runSearchWith({ qOverride, typeOverride, entityId }) {
    suppressSuggestRef.current = true
    setShowSug(false)
    setSug({ hashtags: [], labels: [], entities: [], durationMs: 0 })
    reqIdRef.current++
    inputRef.current?.blur()

    const qText = (qOverride ?? q)?.trim()
    const types = [] // Everything
    runSoon(() => navigateToResults({ qText, types, etype: typeOverride, eid: entityId }))
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') runSearch()
    if (e.key === 'Escape') {
      suppressSuggestRef.current = true
      setShowSug(false)
      setSug({ hashtags: [], labels: [], entities: [], durationMs: 0 })
      reqIdRef.current++
    }
  }

  const summary = useMemo(() => summarizeTypes(selTypes), [selTypes])
  const allKeys = ALL_TYPES.map(t => t.key)

  return (
    <HStack ml="25%" gap="10px" align="stretch" position="relative" padding={5}>
      <Input
        ref={inputRef}
        placeholder="Busca por texto, #hashtag, label:code…"
        value={q}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (q.trim().length >= 2 && !suppressSuggestRef.current) setShowSug(true)
        }}
        minW="320px"
      />

      <Box position="relative">
        <Button variant="outline" onClick={() => setOpenTypes(v => !v)}>{summary} ▾</Button>
        {openTypes && (
          <Box
            position="absolute"
            right="0"
            mt="2"
            zIndex="dropdown"
            bg="bg"
            borderWidth="1px"
            rounded="md"
            shadow="lg"
            minW="260px"
            p="10px"
          >
            <VStack align="stretch" gap="10px">
              <Text fontWeight="medium">Buscar:</Text>

              <Button
                size="sm"
                variant={selTypes.size === ALL_TYPES.length ? 'solid' : 'ghost'}
                onClick={() => setSelTypes(new Set(allKeys))}
                justifyContent="flex-start"
              >
                Todo
              </Button>

              <VStack align="stretch" gap="8px">
                {ALL_TYPES.map(t => (
                  <Checkbox.Root
                    key={t.key}
                    checked={selTypes.has(t.key)}
                    onCheckedChange={(v) => {
                      const checked = typeof v === 'boolean' ? v : !!v?.checked
                      setSelTypes(prev => {
                        const next = new Set(prev)
                        if (checked) next.add(t.key)
                        else next.delete(t.key)
                        return next.size === 0 ? new Set(allKeys) : next
                      })
                    }}
                  >
                    <HStack w="full" justify="flex-start" cursor="pointer">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>{t.label}</Checkbox.Label>
                    </HStack>
                    <Checkbox.HiddenInput />
                  </Checkbox.Root>
                ))}
              </VStack>

              <HStack justify="flex-end" gap="2">
                <Button variant="ghost" onClick={() => setOpenTypes(false)}>Cerrar</Button>
                <Button onClick={() => { setOpenTypes(false); runSearch() }} colorPalette="brand">Buscar</Button>
              </HStack>
            </VStack>
          </Box>
        )}
      </Box>

      {/* Botón Buscar + Badge contextual */}
      <HStack>
        <Button onClick={runSearch} colorPalette="brand">
          Buscar
        </Button>
        {q.trim().length >= 2 && showSug && !busy && (
          <Badge variant="subtle" colorPalette="gray">
            {totalSuggest === 0 ? 'Sin Resultados' : /* NO mostrar número si lo hubiera */ ' '}
          </Badge>
        )}
      </HStack>

      {showSug && (busy || sug.hashtags.length > 0 || sug.labels.length > 0 || sug.entities.length > 0) && (
        <Box
          position="absolute"
          top="calc(100% + 6px)"
          left="0"
          right="0"
          zIndex={1000}
          bg="bg"
          borderWidth="1px"
          rounded="md"
          shadow="xl"
          p="10px"
        >
          {busy && (
            <HStack color="fg.muted" fontSize="sm" mb="8px">
              <Spinner size="sm" /><Text>Buscando…</Text>
            </HStack>
          )}

          {/* Hashtags */}
          {sug.hashtags?.length > 0 && (
            <Box mb="8px">
              <Text fontSize="xs" color="fg.muted" mb="4px">Hashtags</Text>
              <HStack wrap="wrap" gap="6px">
                {sug.hashtags.map(tag => (
                  <Badge
                    key={tag}
                    as="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const v = `#${tag}`
                      setQ(v)
                      runSearchWith({ qOverride: v })
                    }}
                    variant="subtle"
                  >
                    #{tag}
                  </Badge>
                ))}
              </HStack>
            </Box>
          )}

          {/* Etiquetas */}
          {sug.labels?.length > 0 && (
            <Box mb="8px">
              <Text fontSize="xs" color="fg.muted" mb="4px">Etiquetas</Text>
              <HStack wrap="wrap" gap="6px">
                {sug.labels.map(l => (
                  <Badge
                    key={l.id}
                    as="button"
                    title={l.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const v = `label:${l.code}`
                      setQ(v)
                      runSearchWith({ qOverride: v })
                    }}
                    style={{ background: l.colorHex, color: '#fff' }}
                  >
                    {l.code}
                  </Badge>
                ))}
              </HStack>
            </Box>
          )}

          {/* Entidades */}
          {sug.entities?.length > 0 && (
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="4px">Entidades</Text>
              <VStack align="stretch" gap="4px" maxH="240px" overflowY="auto">
                {sug.entities.map(e => (
                  <Button
                    key={`${e.type}-${e.id}`}
                    variant="ghost"
                    justifyContent="flex-start"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      const v = e.title || ''
                      setQ(v)
                      runSearchWith({ qOverride: v, typeOverride: e.type, entityId: e.id })
                    }}
                  >
                    <Text fontWeight="medium" mr="2">{e.title || e.id}</Text>
                    <Badge>{e.type}</Badge>
                  </Button>
                ))}
              </VStack>
            </Box>
          )}

          {!busy && !sug.hashtags?.length && !sug.labels?.length && !sug.entities?.length && (
            <Text fontSize="sm" color="fg.muted">Sin sugerencias</Text>
          )}
        </Box>
      )}
    </HStack>
  )
}
