// src/pages/clinic/ClinicAssessmentsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box, Heading, Text, HStack, VStack, Button, IconButton,
  Input, Badge, Spinner,
} from '@chakra-ui/react'
import { FiRefreshCw, FiSearch, FiPlay } from 'react-icons/fi'
import { toaster } from '../../components/ui/toaster'
import { TestsApi } from '../../api/testsApi'

// Diálogo y runner de la evaluación
import TestStartDialog from '../../components/assessments/TestStartDialog'
import TestRunnerFullScreen from './TestRunnerFullScreen'

// --- Token “avatar-like” para disciplina (sin Avatar de Chakra) ---
function DisciplineAvatar({ code, bg = 'brand.50', color = 'brand.700', title }) {
  const text = (code || '').toUpperCase().slice(0, 3)
  return (
    <Box
      as="span"
      title={title || code}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      w="26px"
      h="26px"
      rounded="full"
      bg={bg}
      color={color}
      fontWeight="bold"
      fontSize="xs"
      borderWidth="1px"
      borderColor="blackAlpha.200"
      userSelect="none"
      flexShrink={0}
    >
      {text || '—'}
    </Box>
  )
}

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

// Colores conocidos por disciplina (fallback si no hay categoría/subcategoría)
const KNOWN_DISC_COLORS = [
  { match: /^psi/, color: 'purple.600', avatarBg: 'purple.50', avatarColor: 'purple.700' },
  { match: /^edu/, color: 'teal.600',   avatarBg: 'teal.50',   avatarColor: 'teal.700'   },
  { match: /^neu/, color: 'orange.600', avatarBg: 'orange.50', avatarColor: 'orange.700' },
]

// Paleta para hashing determinista
const PALETTE = [
  'red.600','orange.600','yellow.600','green.600','teal.600',
  'cyan.600','blue.600','purple.600','pink.600','gray.600'
]

function hashToIndex(str) {
  if (!str) return 0
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) % PALETTE.length
}

function pickStripeColorFromKey(key) {
  const k = (key || '').toLowerCase()
  for (const d of KNOWN_DISC_COLORS) {
    if (d.match.test(k)) return d.color
  }
  return PALETTE[hashToIndex(k)]
}

function pickAvatarColorsFromDiscipline(code) {
  const k = (code || '').toLowerCase()
  for (const d of KNOWN_DISC_COLORS) {
    if (d.match.test(k)) return { bg: d.avatarBg, color: d.avatarColor }
  }
  return { bg: 'gray.100', color: 'gray.800' }
}

/** Normaliza 1 ítem de taxonomía con claves variadas -> forma canónica */
function normalizeTaxItem(t) {
  if (!t || typeof t !== 'object') return null
  const dCode = t.disciplineCode ?? t.discipline_code ?? t.disciplinecode ?? t.disc_code ?? t.dcode
  const dName = t.disciplineName ?? t.discipline_name ?? t.disciplinename
  const cCode = t.categoryCode ?? t.category_code ?? t.categorycode ?? t.cat_code ?? t.ccode
  const cName = t.categoryName ?? t.category_name ?? t.categoryname
  const sCode = t.subcategoryCode ?? t.subcategory_code ?? t.subcategorycode ?? t.subcat_code ?? t.scode
  const sName = t.subcategoryName ?? t.subcategory_name ?? t.subcategoryname
  return {
    disciplineCode: dCode || null,
    disciplineName: dName || null,
    categoryCode: cCode || null,
    categoryName: cName || null,
    subcategoryCode: sCode || null,
    subcategoryName: sName || null,
  }
}

/** normaliza `t.taxonomy`: string JSON | {items:[]} | [] -> always [] de objetos canónicos */
function normalizeTaxonomy(x) {
  let arr = []
  if (!x) arr = []
  else if (Array.isArray(x)) arr = x
  else if (typeof x === 'string') {
    try { arr = JSON.parse(x) || [] } catch { arr = [] }
  } else if (x && Array.isArray(x.items)) {
    arr = x.items
  }
  return arr
    .map(normalizeTaxItem)
    .filter(Boolean)
}

export default function ClinicAssessmentsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)

  // filtros
  const [q, setQ] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')

  // paginación
  const [page, setPage] = useState(1)
  const [pageSize] = useState(24)

  // modal iniciar
  const [startOpen, setStartOpen] = useState(false)
  const [startTest, setStartTest] = useState(null)

  // Deep-link: abrir TestStartDialog si viene ?openAssignTestId=...
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const testId = params.get('openAssignTestId');
    if (!testId) return;

    (async () => {
      let tObj = Array.isArray(items) ? items.find(t => String(t.id) === String(testId)) : null;
      if (!tObj) {
        try {
          // Seguro para clínicos: TestsApi.getById usa /clinician/tests/{id}
          tObj = await TestsApi.getById(testId);
        } catch (e) {
          console.warn('No se pudo cargar el test por id, usando nombre del query', e);
          const fallbackName = params.get('openAssignTestName') || 'Test';
          tObj = { id: testId, name: fallbackName };
        }
      }
      setStartTest(tObj);
      setStartOpen(true);

      // Limpia los params para evitar re-aperturas
      const u = new URL(window.location.href);
      u.searchParams.delete('openAssignTestId');
      u.searchParams.delete('openAssignTestName');
      const next = u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '');
      navigate(next, { replace: true });
    })();
  }, [location.search, Array.isArray(items) ? items.length : 0]);


  // runner full-screen
  const [runnerOpen, setRunnerOpen] = useState(false)
  const [runnerCtx, setRunnerCtx] = useState({ test: null, patient: null, assignmentId: null })

  async function load(p = page) {
    setLoading(true)
    try {
      const data = await TestsApi.listForMe({ page: p, pageSize, search: q || undefined })
      setItems(data?.items || [])
      setTotal(data?.total ?? 0)
    } catch (e) {
      toaster.error({ title: 'No se pudieron cargar evaluaciones', description: getErrorMessage(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, []) // carga inicial

  // Deriva opciones de filtro desde la taxonomía (normalizada)
  const filterOptions = useMemo(() => {
    const dset = new Set(), cset = new Set(), sset = new Set()
    for (const it of items) {
      const tax = normalizeTaxonomy(it.taxonomy)
      for (const t of tax) {
        if (t.disciplineCode) dset.add(JSON.stringify({ code: t.disciplineCode, name: t.disciplineName || t.disciplineCode }))
        if (t.categoryCode)   cset.add(JSON.stringify({ code: t.categoryCode,   name: t.categoryName   || t.categoryCode   }))
        if (t.subcategoryCode)sset.add(JSON.stringify({ code: t.subcategoryCode,name: t.subcategoryName|| t.subcategoryCode}))
      }
    }
    const parse = (s) => { try { return JSON.parse(s) } catch { return null } }
    return {
      disciplines: Array.from(dset).map(parse).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
      categories:  Array.from(cset).map(parse).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
      subcategories:Array.from(sset).map(parse).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [items])

  // Filtrado local adicional (usando taxonomía normalizada)
  const filtered = useMemo(() => {
    return items.filter(it => {
      const tax = normalizeTaxonomy(it.taxonomy)
      const matchD = !discipline || tax.some(t => t.disciplineCode === discipline)
      const matchC = !category   || tax.some(t => t.categoryCode   === category)
      const matchS = !subcategory|| tax.some(t => t.subcategoryCode=== subcategory)
      return matchD && matchC && matchS
    })
  }, [items, discipline, category, subcategory])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <Box>
      <HStack mb="4" wrap="wrap" justify="space-between" align="center">
        <Heading size="md">Evaluaciones disponibles</Heading>
        <HStack as="form" onSubmit={(e) => { e.preventDefault(); setPage(1); load(1) }} gap="2">
          <Input
            size="sm"
            placeholder="Buscar por nombre o código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            w="240px"
          />
          <IconButton size="sm" aria-label="Buscar" type="submit"><FiSearch /></IconButton>
          <IconButton size="sm" aria-label="Recargar" onClick={() => load(page)}><FiRefreshCw /></IconButton>
        </HStack>
      </HStack>

      {/* Filtros por taxonomía (select nativo para evitar compuestos v3) */}
      <HStack gap="3" mb="4" wrap="wrap">
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', minWidth: 220 }}
        >
          <option value="">Filtrar por disciplina</option>
          {filterOptions.disciplines.map(d => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', minWidth: 220 }}
        >
          <option value="">Filtrar por categoría</option>
          {filterOptions.categories.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>

        <select
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--chakra-colors-border)', minWidth: 240 }}
        >
          <option value="">Filtrar por subcategoría</option>
          {filterOptions.subcategories.map(s => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>

        {(discipline || category || subcategory) && (
          <Button size="sm" variant="outline" onClick={() => { setDiscipline(''); setCategory(''); setSubcategory('') }}>
            Limpiar
          </Button>
        )}
      </HStack>

      {/* Grid de tarjetas con FRANJA SUPERIOR de color */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))"
        gap="14px"
      >
        {loading ? (
          <Box p="6" borderWidth="1px" borderRadius="lg" bg="white">
            <HStack color="fg.muted"><Spinner /><Text>Cargando…</Text></HStack>
          </Box>
        ) : filtered.length === 0 ? (
          <Box p="6" borderWidth="1px" borderRadius="lg" bg="white">
            <Text color="fg.muted">No hay evaluaciones disponibles con los filtros actuales.</Text>
          </Box>
        ) : (
          filtered.map((t) => {
            const tax = normalizeTaxonomy(t.taxonomy)

            // 1) Datos para avatar (disciplina)
            const mainTax = tax[0] || null
            const discCode = mainTax?.disciplineCode || ''
            const discName = mainTax?.disciplineName || ''
            const avatarColors = pickAvatarColorsFromDiscipline(discCode)

            // 2) Clave para color de franja (prioriza subcat > cat > disciplina > código del test)
            const stripeKey = mainTax?.subcategoryCode || mainTax?.categoryCode || discCode || t.code
            const stripeColor = pickStripeColorFromKey(stripeKey)

            return (
              <Box
                key={t.id}
                p="4"
                borderWidth="1px"
                borderRadius="lg"
                bg="white"
                display="flex"
                flexDirection="column"
                gap="10px"
                position="relative"
                _hover={{ boxShadow: 'sm' }}
              >
                {/* Franja superior */}
                <Box
                  aria-hidden="true"
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  height="6px"
                  bg={stripeColor}
                  borderTopLeftRadius="lg"
                  borderTopRightRadius="lg"
                />

                <HStack justify="space-between" align="center" mt="1">
                  <HStack gap="2" align="center">
                    <DisciplineAvatar
                      code={discCode}
                      bg={avatarColors.bg}
                      color={avatarColors.color}
                      title={discName}
                    />
                    <VStack align="start" gap="0" minW={0}>
                      <Text fontWeight="semibold" noOfLines={1}>{t.name}</Text>
                      <Text fontSize="sm" color="fg.muted">{t.code}</Text>
                    </VStack>
                  </HStack>
                  <Badge variant="subtle">{t.ageGroupName || '—'}</Badge>
                </HStack>

                <Text fontSize="sm" color="fg.muted" noOfLines={3}>
                  {t.description || 'Sin descripción'}
                </Text>

                {/* Chips de taxonomía */}
                <HStack wrap="wrap" gap="1">
                  {tax.map((x, idx) => (
                    <Badge key={idx} variant="solid" colorPalette="gray">
                      {x.disciplineName}{x.categoryName ? ` · ${x.categoryName}` : ''}{x.subcategoryName ? ` · ${x.subcategoryName}` : ''}
                    </Badge>
                  ))}
                </HStack>

                <Box h="1px" bg="blackAlpha.200" />

                <HStack justify="flex-end">
                  <Button
                    size="sm"
                    rightIcon={<FiPlay />}
                    colorPalette="brand"
                    onClick={() => {
                      setStartTest(t)
                      setStartOpen(true)
                    }}
                  >
                    Iniciar
                  </Button>
                </HStack>
              </Box>
            )
          })
        )}
      </Box>

      {/* Paginación simple */}
      <HStack justify="space-between" mt="4">
        <Text color="fg.muted" fontSize="sm">Total: {total}</Text>
        <HStack>
          <Button
            size="sm"
            onClick={() => { if (canPrev) { const p = page - 1; setPage(p); load(p) } }}
            disabled={!canPrev}
          >
            Anterior
          </Button>
          <Text fontSize="sm">Página {page} / {Math.max(1, Math.ceil(total / pageSize))}</Text>
          <Button
            size="sm"
            onClick={() => { if (canNext) { const p = page + 1; setPage(p); load(p) } }}
            disabled={!canNext}
          >
            Siguiente
          </Button>
        </HStack>
      </HStack>

      <TestStartDialog
  // key={startOpen ? `dlg-${startTest?.id || 'new'}` : 'closed'}
  // open={startOpen}
  // test={startTest}
  // onClose={() => setStartOpen(false)}
  // onStarted={(ctx) => setRunnerCtx(ctx)}
  key={startOpen ? `dlg-${startTest?.id || 'new'}` : 'closed'}
  open={startOpen}
  onOpenChange={setStartOpen}      // <- importante: conectar el cierre controlado
  test={startTest}
  onStarted={(ctx) => {           // ctx = { test, patient, assignmentId, ... }
    setRunnerCtx(ctx)
    setRunnerOpen(true)
  }}
/>

      {/* Runner pantalla completa */}
      <TestRunnerFullScreen
        open={runnerOpen}
        onClose={() => setRunnerOpen(false)}
        test={runnerCtx.test}
        patient={runnerCtx.patient}
        assignmentId={runnerCtx.assignmentId}
      />
    </Box>
  )
}
