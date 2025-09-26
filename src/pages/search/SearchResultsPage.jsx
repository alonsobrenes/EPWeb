// src/pages/search/SearchResultsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Heading, HStack, VStack, Text, Badge, Button, Table, Spinner
} from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toaster } from '../../components/ui/toaster'
import { SearchApi } from '../../api/searchApi'

const ALL_TYPES = [
  { key: 'patient',     label: 'Pacientes' },
  { key: 'interview',   label: 'Entrevistas' },
  { key: 'session',     label: 'Sesiones' },
  { key: 'test',        label: 'Tests' },
  { key: 'attachment',  label: 'Adjuntos' },
]

const DEFAULT_PAGE_SIZE = 20

function useQueryParams() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

function parseTypesFromQS(qs) {
  const all = qs.getAll('type')
  if (!all || all.length === 0) return new Set(ALL_TYPES.map(t => t.key)) // Everything
  const valid = new Set(ALL_TYPES.map(t => t.key))
  return new Set(all.filter(t => valid.has(t)))
}

function parseMulti(qs, key) {
  const arr = qs.getAll(key)
  return Array.isArray(arr) ? arr.filter(Boolean) : []
}

function toIsoOrNull(s) {
  if (!s) return null
  try {
    const d = new Date(s)
    if (Number.isNaN(+d)) return null
    return d.toISOString()
  } catch { return null }
}

function closeSuggestPanel() {
  try { window.dispatchEvent(new CustomEvent('global-search:close-suggest')) } catch {}
}

// BEGIN CHANGE: usar navegación SPA dentro de la fila
function ResultRow({ r, onTagClick, onLabelClick }) {
  const navigate = useNavigate()
  const labels = Array.isArray(r.labels) ? r.labels : []
  const tags = Array.isArray(r.hashtags) ? r.hashtags : []

  const openResult = (e) => {
    try {
      e?.preventDefault?.()
      closeSuggestPanel()
      const url = r.url || ''
      // Internas: navegar con react-router (mejor UX, sin recarga completa)
      if (url.startsWith('/')) {
        navigate(url)
      } else if (url) {
        // Externas (por si en el futuro aparece alguna): degradar sin romper
        window.location.assign(url)
      }
    } catch {
      // noop: si algo falla, no rompemos UI
    }
  }

  return (
    <Table.Row>
      <Table.Cell>
        <HStack gap="2">
          <Badge>{r.type}</Badge>
          <Text fontWeight="medium">{r.title || '(sin título)'}</Text>
        </HStack>
        {r.snippet && (
          <Text color="fg.muted" fontSize="sm" noOfLines={2} mt="1">
            {r.snippet}
          </Text>
        )}
        {(labels.length > 0 || tags.length > 0) && (
          <HStack gap="2" mt="2" wrap="wrap">
            {labels.map(l => (
              <Badge
                key={`l-${l.id ?? l.code ?? l.name}`}
                style={{ background: l.colorHex, color: '#fff', cursor: 'pointer' }}
                title={`Filtrar por etiqueta: ${l.name ?? l.code}`}
                onClick={() => onLabelClick?.(l)}
              >
                {l.code || l.name}
              </Badge>
            ))}
            {tags.map(t => (
              <Badge
                key={`t-${t}`}
                variant="subtle"
                cursor="pointer"
                title={`Filtrar por #${t}`}
                onClick={() => onTagClick?.(t)}
              >
                #{t}
              </Badge>
            ))}
          </HStack>
        )}
      </Table.Cell>
      <Table.Cell textAlign="right" minW="160px">
        {r.updatedAt && <Text fontSize="sm">{new Date(r.updatedAt).toLocaleString()}</Text>}
        {r.url && (
          <Button
            size="xs"
            variant="outline"
            mt="2"
            onClick={openResult}
          >
            Abrir
          </Button>
        )}
      </Table.Cell>
    </Table.Row>
  )
}
// END CHANGE

export default function SearchResultsPage() {
  const navigate = useNavigate()
  const qs = useQueryParams()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(qs.get('page') || 1))
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)

  // filtros desde QS
  const [q, setQ] = useState(qs.get('q') || '')
  const [selTypes, setSelTypes] = useState(() => parseTypesFromQS(qs))
  const [dateFrom, setDateFrom] = useState(qs.get('from') || '')
  const [dateTo, setDateTo] = useState(qs.get('to') || '')
  const [selTags, setSelTags] = useState(() => parseMulti(qs, 'tag'))
  const [selLabels, setSelLabels] = useState(() => parseMulti(qs, 'label'))

  // marcadores cuando se llega desde click de entidad
  const [entityType, setEntityType] = useState(qs.get('etype') || '')
  const [entityId, setEntityId] = useState(qs.get('eid') || '')

  useEffect(() => { closeSuggestPanel() }, [])

  // sync con QS
  useEffect(() => {
    setQ(qs.get('q') || '')
    setPage(Number(qs.get('page') || 1))
    setSelTypes(parseTypesFromQS(qs))
    setDateFrom(qs.get('from') || '')
    setDateTo(qs.get('to') || '')
    setSelTags(parseMulti(qs, 'tag'))
    setSelLabels(parseMulti(qs, 'label'))
    setEntityType(qs.get('etype') || '')
    setEntityId(qs.get('eid') || '')
  }, [qs])

  const selectedTypesForApi = useMemo(() => {
    const all = ALL_TYPES.map(t => t.key)
    return selTypes.size === all.length ? [] : [...selTypes]
  }, [selTypes])

  async function runSearch() {
    try {
      setLoading(true)
      const body = {
        q: q.trim() || null,
        types: selectedTypesForApi,            // Everything si []
        labels: selLabels,
        hashtags: selTags,
        dateFromUtc: toIsoOrNull(dateFrom),
        dateToUtc: toIsoOrNull(dateTo),
        page,
        pageSize,
      }
      const res = await SearchApi.search(body)
      let list = Array.isArray(res?.items) ? res.items : []
      let count = Number(res?.total || 0)

      // 🔎 Si venimos desde un clic de entidad, filtramos client-side
      if (entityType) {
        list = list.filter(it => it.type === entityType && (!entityId || String(it.id) === String(entityId)))
        count = list.length
      }
      setItems(list)
      setTotal(count)
    } catch (e) {
      toaster.error({ title: 'No se pudo buscar', description: e?.message || 'Error' })
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    JSON.stringify(selectedTypesForApi),
    dateFrom,
    dateTo,
    q,
    JSON.stringify(selTags),
    JSON.stringify(selLabels),
    entityType,
    entityId
  ])

  // Helpers QS (paginación y chips)
  const updateQS = (next) => {
    const u = new URL(window.location.href)
    const sp = u.searchParams
    if (next.q != null) (next.q ? sp.set('q', next.q) : sp.delete('q'))
    sp.delete('type')
    const keys = next.types && next.types.length ? next.types : ALL_TYPES.map(t => t.key)
    keys.forEach(t => sp.append('type', t))
    if (next.from != null) (next.from ? sp.set('from', next.from) : sp.delete('from'))
    if (next.to   != null) (next.to   ? sp.set('to',   next.to)   : sp.delete('to'))
    sp.delete('tag');   (next.tags   ?? selTags).forEach(t => sp.append('tag', t))
    sp.delete('label'); (next.labels ?? selLabels).forEach(l => sp.append('label', l))

    // al navegar manualmente desde la página, anulamos cualquier etype/eid
    sp.delete('etype'); sp.delete('eid')

    sp.set('page', String(next.page || 1))
    closeSuggestPanel()
    navigate(u.pathname + '?' + sp.toString(), { replace: true })
  }

  const addHashtag = (tag) => {
    const next = [...new Set([...selTags, tag])]
    updateQS({ q, types: selectedTypesForApi, from: dateFrom, to: dateTo, page: 1, tags: next, labels: selLabels })
  }
  const addLabel = (label) => {
    const code = label?.code || label?.name
    if (!code) return
    const next = [...new Set([...selLabels, code])]
    updateQS({ q, types: selectedTypesForApi, from: dateFrom, to: dateTo, page: 1, tags: selTags, labels: next })
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const prevPage = () => updateQS({ q, types: selectedTypesForApi, from: dateFrom, to: dateTo, page: Math.max(1, page - 1) })
  const nextPage = () => updateQS({ q, types: selectedTypesForApi, from: dateFrom, to: dateTo, page: Math.min(pageCount, page + 1) })

  return (
    <VStack align="stretch" gap="14px" p="16px">
      <Heading size="md">Resultados de búsqueda</Heading>

      <Box borderWidth="1px" rounded="md" overflow="hidden">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Resultado</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right" minW="160px">Actualizado</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={2}>
                  <HStack gap="2"><Spinner size="sm" /><Text>Cargando…</Text></HStack>
                </Table.Cell>
              </Table.Row>
            ) : items.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={2}><Text color="fg.muted">Sin resultados</Text></Table.Cell>
              </Table.Row>
            ) : (
              items.map(r => (
                <ResultRow
                  key={`${r.type}-${r.id}`}
                  r={r}
                  onTagClick={addHashtag}
                  onLabelClick={addLabel}
                />
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      <HStack justify="space-between">
        <Text color="fg.muted" fontSize="sm">
          Página {page} de {pageCount} — {total} resultado(s)
        </Text>
        <HStack>
          <Button size="sm" onClick={prevPage} isDisabled={page <= 1}>Anterior</Button>
          <Button size="sm" onClick={nextPage} isDisabled={page >= pageCount}>Siguiente</Button>
        </HStack>
      </HStack>
    </VStack>
  )
}
