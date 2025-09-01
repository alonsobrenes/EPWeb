// src/pages/clinic/TestStartDialog.jsx
import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Box, Heading, Text, Button, CloseButton, HStack, VStack, Separator,
  Spinner, Badge, Input
} from '@chakra-ui/react'
import { toaster } from './../../components/ui/toaster'
import api from '../../api/client'               // axios con baseURL al API (p.ej. https://localhost:53793/api)
import { AssignmentsApi } from '../../api/assignmentsApi'

/** Lee el origin del API a partir de axios.baseURL o VITE_API_BASE */
function getApiOrigin() {
  const b = api?.defaults?.baseURL
  if (b && /^https?:\/\//i.test(b)) {
    try { return new URL(b).origin } catch {}
  }
  const env = (import.meta?.env?.VITE_API_BASE || '').trim()
  if (env && /^https?:\/\//i.test(env)) {
    try { return new URL(env).origin } catch {}
  }
  return null
}

/** Normaliza la ruta del PDF a una URL ABSOLUTA contra el origin del API */
function resolvePdfUrl(raw) {
  if (!raw) return null
  let u = String(raw).trim()

  if (/^https?:\/\//i.test(u)) {
    try {
      const abs = new URL(u)
      abs.pathname = abs.pathname.replace(/^\/api\/uploads\//, '/uploads/')
      return abs.href
    } catch { return u }
  }

  if (!u.startsWith('/')) u = '/' + u
  u = u.replace(/^\/api\/uploads\//, '/uploads/')
  u = u.replace(/^\/?uploads\//, '/uploads/')

  const origin = getApiOrigin()
  return origin ? origin + u : u
}

const heights = { base: '300px', md: '360px', lg: '420px' }

function PdfPreview({ url }) {
  const finalUrl = useMemo(() => resolvePdfUrl(url), [url])
  const [loaded, setLoaded] = useState(false)
  const hideTimer = useRef(null)

  function handleLoad() {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setLoaded(true), 150)
  }

  if (!url) {
    return (
      <Box rounded="lg" borderWidth="1px" h={heights} bg="blackAlpha.50" display="grid" placeItems="center">
        <Text color="fg.muted">Este test no tiene PDF asociado.</Text>
      </Box>
    )
  }

  return (
    <Box position="relative" rounded="lg" overflow="hidden" borderWidth="1px" bg="black" h={heights}>
      {!loaded && (
        <Box position="absolute" inset="0" display="grid" placeItems="center" bg="blackAlpha.500" zIndex="1">
          <HStack color="whiteAlpha.900"><Spinner /><Text>Cargando PDF…</Text></HStack>
        </Box>
      )}
      <iframe
        title="pdf-preview"
        src={`${finalUrl}#toolbar=0&view=FitH`}
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    </Box>
  )
}

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

/** Item visual en la lista de resultados */
function PatientRow({ p, onSelect }) {
  const first = p.firstName ?? p.first_name ?? ''
  const last1 = p.lastName1 ?? p.last_name1 ?? ''
  const last2 = p.lastName2 ?? p.last_name2 ?? ''
  const display = [first, last1, last2].filter(Boolean).join(' ') || 'Sin nombre'

  const idType = p.identificationType ?? p.identification_type ?? ''
  const idNum  = p.identificationNumber ?? p.identification_number ?? ''
  const idText = [idType, idNum].filter(Boolean).join(': ')

  return (
    <Box
      as="button"
      type="button"
      onClick={() => onSelect?.(p)}
      textAlign="left"
      w="100%"
      p="2.5"
      borderRadius="md"
      _hover={{ bg: 'blackAlpha.50' }}
    >
      <Text fontWeight="medium" noOfLines={1}>{display}</Text>
      {idText && <Text fontSize="sm" color="fg.muted" noOfLines={1}>{idText}</Text>}
    </Box>
  )
}

/** Buscador simple por nombre (debounced) */
function PatientSearch({ onSelected }) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    if (!q || q.trim().length < 2) {
      setResults([])
      setError(null)
      return
    }
    timer.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        // Ajusta si tu endpoint difiere
        const PATH = '/patients'
        const { data } = await api.get(PATH, { params: { search: q.trim(), page: 1, pageSize: 10 } })
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
        setResults(items)
      } catch (e) {
        setError(getErrorMessage(e))
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [q])

  return (
    <VStack align="stretch" gap="2">
      <Box>
        <Text fontSize="sm" mb="1">Buscar paciente por nombre</Text>
        <Input
          placeholder="Ej.: Ana López"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
        />
      </Box>

      {loading && (
        <HStack color="fg.muted" fontSize="sm"><Spinner size="sm" /><Text>Buscando…</Text></HStack>
      )}

      {error && (
        <Box borderWidth="1px" borderColor="red.200" bg="red.50" p="2" rounded="md">
          <Text fontSize="sm" color="red.700">No se pudo buscar pacientes: {error}</Text>
        </Box>
      )}

      {results.length > 0 && (
        <Box borderWidth="1px" rounded="md" overflow="hidden">
          {results.map((p) => (
            <PatientRow key={p.id} p={p} onSelect={onSelected} />
          ))}
        </Box>
      )}
    </VStack>
  )
}

export default function TestStartDialog({ open, onOpenChange, test, onStarted }) {
  if (!open) return null

  const name = test?.name || 'Test'
  const code = test?.code || ''
  const description = test?.description || 'Sin descripción.'
  const instructions = test?.instructions || null
  const pdfUrl = useMemo(() => test?.pdfUrl || test?.pdf_url || null, [test])

  const ageGroup = test?.ageGroupName || test?.age_group_name || '—'
  const questionCount = Number.isFinite(test?.questionCount) ? test.questionCount : (test?.question_count ?? null)

  // Selección de paciente
  const [patientId, setPatientId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // reset al abrir
    setPatientId('')
    setPatientName('')
  }, [open])

  async function handleStart() {
    if (!test?.id) {
      toaster.error({ title: 'Falta test', description: 'No hay un test seleccionado.' })
      return
    }
    if (!patientId) {
      toaster.error({ title: 'Paciente requerido', description: 'Selecciona un paciente por nombre.' })
      return
    }

    setBusy(true)
    try {
      const a = await AssignmentsApi.create({
        testId: test.id,
        patientId,
        respondentRole: 'PATIENT',
        relationLabel: null,
        dueAt: null,
      })
      const assignmentId = a?.id ?? a?.data?.id ?? null
      toaster.success({ title: 'Listo', description: 'Asignación creada.' })
      onOpenChange?.(false)
      onStarted?.({ test, testId: test.id, patient: { id: patientId, name: patientName }, patientId, assignmentId })
    } catch (err) {
      toaster.error({ title: 'No se pudo iniciar', description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <Box position="fixed" inset="0" bg="blackAlpha.600" zIndex="modal" />

      {/* Modal */}
      <Box role="dialog" aria-modal="true"
           position="fixed" inset="0" display="grid" placeItems="center" zIndex="modal">
        <Box bg="white" rounded="xl" shadow="lg" borderWidth="1px"
             width="min(96vw, 1180px)" p={{ base: 4, md: 6 }} position="relative">
          <CloseButton position="absolute" top="3" right="3" onClick={() => onOpenChange?.(false)} />

          {/* Encabezado */}
          <Heading size="xl" mb="1" lineHeight="short">{name}</Heading>
          {code ? <Text color="fg.muted" mb="4">{code}</Text> : null}

          {/* Grid: PDF a la izquierda, info + asignación a la derecha */}
          <Box
            display="grid"
            gap={{ base: '16px', md: '20px' }}
            gridTemplateColumns={{ base: '1fr', lg: '1fr 380px' }}
            alignItems="start"
          >
            {/* Columna izquierda */}
            <VStack align="stretch" gap="3">
              <HStack gap="2" wrap="wrap">
                <Badge variant="subtle">Grupo etario: {ageGroup}</Badge>
                {questionCount != null && (
                  <Badge variant="subtle">{questionCount} preguntas</Badge>
                )}
              </HStack>
              <PdfPreview url={pdfUrl} />
            </VStack>

            {/* Columna derecha (con scroll, incluye asignación simple) */}
            <VStack align="stretch" gap="4" maxH={heights} overflowY="auto" pr="1">
              <Box>
                <Heading size="sm" mb="1">Descripción</Heading>
                <Text color="fg.muted">{description}</Text>
              </Box>

              <Separator />

              <Box>
                <Heading size="sm" mb="1">Instrucciones</Heading>
                <Text color="fg.muted">{instructions || '—'}</Text>
              </Box>

              <Separator />

              <Box borderWidth="1px" rounded="lg" p="4" bg="white">
                <Heading size="sm" mb="3">Asignar evaluación</Heading>

                {!patientId ? (
                  <PatientSearch
                    onSelected={(p) => {
                      const first = p.firstName ?? p.first_name ?? ''
                      const last1 = p.lastName1 ?? p.last_name1 ?? ''
                      const last2 = p.lastName2 ?? p.last_name2 ?? ''
                      const display = [first, last1, last2].filter(Boolean).join(' ') || 'Paciente'
                      setPatientId(p.id)
                      setPatientName(display)
                      toaster.success({ title: 'Paciente seleccionado', description: display })
                    }}
                  />
                ) : (
                  <HStack justify="space-between">
                    <Badge colorPalette="green">Seleccionado: {patientName}</Badge>
                    <Button size="sm" variant="outline" onClick={() => { setPatientId(''); setPatientName('') }}>
                      Cambiar
                    </Button>
                  </HStack>
                )}
              </Box>
            </VStack>
          </Box>

          {/* Footer */}
          <HStack justify="flex-end" mt="6">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancelar
            </Button>
            <Button colorPalette="brand" loading={busy} onClick={handleStart} disabled={!patientId}>
              Iniciar prueba
            </Button>
          </HStack>
        </Box>
      </Box>
    </>
  )
}
