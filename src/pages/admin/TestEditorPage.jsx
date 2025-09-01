// src/pages/admin/TestEditorPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Heading, HStack, VStack, Text, Input, Textarea,
  Button, IconButton, Badge, Spacer, Spinner, Table, Tabs, Switch,
} from '@chakra-ui/react'
import { FiChevronLeft, FiRefreshCw, FiSave, FiPlus, FiTrash2 } from 'react-icons/fi'
import { TestsApi } from '../../api/testsApi'
import { AgeGroupsApi } from '../../api/ageGroupsApi'
import { DisciplinesApi } from '../../api/disciplinesApi'
import { CategoriesApi } from '../../api/categoriesApi'
import { SubcategoriesApi } from '../../api/subcategoriesApi'
import { toaster } from '../../components/ui/toaster'
import { Tip } from '../../components/ui/tooltip'

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

/** Preguntas + Opciones */
function QuestionsTab({ testId }) {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [options, setOptions] = useState([])
  const [expanded, setExpanded] = useState(() => new Set())

  const optionsByQuestion = useMemo(() => {
    const m = new Map()
    for (const opt of options) {
      const arr = m.get(opt.questionId) || []
      arr.push(opt)
      m.set(opt.questionId, arr)
    }
    for (const [k, arr] of m.entries()) arr.sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
    return m
  }, [options])

  async function loadAll() {
    setLoading(true)
    try {
      const [qs, opts] = await Promise.all([
        TestsApi.getQuestions(testId),
        TestsApi.getQuestionOptions(testId),
      ])
      setQuestions(qs || [])
      setOptions(opts || [])
    } catch (error) {
      toaster.error({ title: 'No se pudieron cargar preguntas/opciones', description: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  const toggleExpand = (qid) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid)
      else next.add(qid)
      return next
    })
  }

  return (
    <Box>
      <HStack mb="3" justify="space-between" wrap="wrap">
        <HStack>
          <Text fontWeight="600">Preguntas</Text>
          <Badge colorPalette="gray">{questions.length}</Badge>
        </HStack>
        <HStack>
          <Tip label="Recargar">
            <IconButton size="sm" onClick={loadAll} aria-label="Recargar">
              <FiRefreshCw />
            </IconButton>
          </Tip>
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader minW="80px">#</Table.ColumnHeader>
              <Table.ColumnHeader minW="120px">Código</Table.ColumnHeader>
              <Table.ColumnHeader>Texto</Table.ColumnHeader>
              <Table.ColumnHeader minW="140px">Tipo</Table.ColumnHeader>
              <Table.ColumnHeader minW="120px">Opciones</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <HStack py="6" justify="center" color="fg.muted">
                    <Spinner /> <Text>Cargando…</Text>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ) : questions.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Box py="6" textAlign="center" color="fg.muted">Sin preguntas</Box>
                </Table.Cell>
              </Table.Row>
            ) : (
              questions
                .slice()
                .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
                .map((q) => {
                  const list = optionsByQuestion.get(q.id) || []
                  const isOpen = expanded.has(q.id)
                  return (
                    <Table.Row
                      key={q.id}
                      onClick={() => toggleExpand(q.id)}
                      _hover={{ bg: 'gray.50', cursor: 'pointer' }}
                      bg={isOpen ? 'gray.50' : undefined}
                    >
                      <Table.Cell>
                        <Badge>{q.orderNo ?? ''}</Badge>
                      </Table.Cell>
                      <Table.Cell><Text fontWeight="600">{q.code}</Text></Table.Cell>
                      <Table.Cell>
                        <VStack align="start" gap="1">
                          <Text>{q.text}</Text>
                          {isOpen && (
                            <VStack align="start" gap="1" mt="2">
                              {list.length === 0 ? (
                                <Text color="fg.muted" fontSize="sm">Esta pregunta no tiene opciones configuradas.</Text>
                              ) : (
                                list.map(opt => (
                                  <HStack key={opt.id} fontSize="sm">
                                    <Badge>{opt.value}</Badge>
                                    <Text>{opt.label}</Text>
                                  </HStack>
                                ))
                              )}
                            </VStack>
                          )}
                        </VStack>
                      </Table.Cell>
                      <Table.Cell><Badge colorPalette="blue">{q.questionType}</Badge></Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={list.length ? 'green' : 'gray'}>
                          {list.length} opc.
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  )
                })
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  )
}

/** Escalas (lectura) */
function ScalesTab({ testId }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  async function load() {
    setLoading(true)
    try {
      const data = await TestsApi.getScales(testId)
      setRows(data || [])
    } catch (error) {
      toaster.error({ title: 'No se pudieron cargar escalas', description: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  return (
    <Box>
      <HStack mb="3" justify="space-between" wrap="wrap">
        <HStack>
          <Text fontWeight="600">Escalas</Text>
          <Badge colorPalette="gray">{rows.length}</Badge>
        </HStack>
        <HStack>
          <Tip label="Recargar">
            <IconButton size="sm" onClick={load} aria-label="Recargar">
              <FiRefreshCw />
            </IconButton>
          </Tip>
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderRadius="md" overflow="hidden">
        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader minW="160px">Código</Table.ColumnHeader>
              <Table.ColumnHeader>Nombre</Table.ColumnHeader>
              <Table.ColumnHeader>Descripción</Table.ColumnHeader>
              <Table.ColumnHeader minW="120px">Estado</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={4}>
                  <HStack py="6" justify="center" color="fg.muted">
                    <Spinner /> <Text>Cargando…</Text>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={4}>
                  <Box py="6" textAlign="center" color="fg.muted">Sin escalas</Box>
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map(s => (
                <Table.Row key={s.id}>
                  <Table.Cell><Text fontWeight="600">{s.code}</Text></Table.Cell>
                  <Table.Cell>{s.name}</Table.Cell>
                  <Table.Cell>{s.description}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={s.isActive ? 'green' : 'gray'}>
                      {s.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  )
}

export default function TestEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ageGroups, setAgeGroups] = useState([])

  // Catálogos
  const [disciplines, setDisciplines] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])

  // Taxonomía (selección pendiente)
  const [selDisc, setSelDisc] = useState('')
  const [selCat, setSelCat] = useState('')
  const [selSub, setSelSub] = useState('')

  // Lista de vínculos actuales (grilla)
  const [taxonomyRows, setTaxonomyRows] = useState([])

  // Form state
  const [form, setForm] = useState({
    id: '',
    code: '',
    name: '',
    ageGroupId: '',
    isActive: true,
    description: '',
    instructions: '',
    pdfUrl: '',
  })

  const onChange = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const hasSelected = ageGroups.some(g => g.id === form.ageGroupId);

  // Catálogos
  async function loadAgeGroups() {
    try { setAgeGroups(await AgeGroupsApi.list() || []) }
    catch (error) { toaster.error({ title: 'No se pudieron cargar grupos etarios', description: getErrorMessage(error) }) }
  }
  async function loadDisciplines() {
    try { setDisciplines((await DisciplinesApi.list({ page:1, pageSize:1000 }))?.items || []) }
    catch (e) { toaster.error({ title: 'No se pudieron cargar disciplinas', description: getErrorMessage(e) }) }
  }
  async function loadCategoriesCatalog() {
    try { setCategories((await CategoriesApi.list({ page:1, pageSize:2000 }))?.items || []) }
    catch (e) { toaster.error({ title: 'No se pudieron cargar categorías', description: getErrorMessage(e) }) }
  }
  async function loadSubcategoriesCatalog() {
    try { setSubcategories((await SubcategoriesApi.list({ page:1, pageSize:5000 }))?.items || []) }
    catch (e) { toaster.error({ title: 'No se pudieron cargar subcategorías', description: getErrorMessage(e) }) }
  }

  // Test header
  async function loadTest() {
    setLoading(true)
    try {
      const t = await TestsApi.getById(id)
      setForm({
        id: t.id,
        code: t.code || '',
        name: t.name || '',
        ageGroupId: t.ageGroupId || '',
        isActive: !!t.isActive,
        description: t.description || '',
        instructions: t.instructions || '',
        pdfUrl: t.pdfUrl || '',
      })
    } catch (error) {
      toaster.error({ title: 'No se pudo cargar el test', description: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  // Taxonomía (lista actual del test)
  async function loadTaxonomy() {
    try { setTaxonomyRows(await TestsApi.getTaxonomy(id) || []) }
    catch (e) { toaster.error({ title: 'No se pudo cargar taxonomía del test', description: getErrorMessage(e) }) }
  }

  useEffect(() => {
    loadAgeGroups()
    loadDisciplines()
    loadCategoriesCatalog()
    loadSubcategoriesCatalog()
    loadTest()
    loadTaxonomy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Filtrados dependientes para el picker "nuevo"
  const catsByDisc = useMemo(
    () => categories.filter(c => !selDisc ? true : c.disciplineId === Number(selDisc)),
    [categories, selDisc]
  )
  const subsByCat = useMemo(
    () => subcategories.filter(s => !selCat ? true : s.categoryId === Number(selCat)),
    [subcategories, selCat]
  )

  const onAddTaxonomy = () => {
    if (!selDisc) {
      toaster.error({ title: 'Seleccione al menos la disciplina' })
      return
    }
    const item = {
      disciplineId: Number(selDisc),
      disciplineCode: disciplines.find(d => d.id === Number(selDisc))?.code,
      disciplineName: disciplines.find(d => d.id === Number(selDisc))?.name,
      categoryId: selCat ? Number(selCat) : null,
      categoryCode: selCat ? catsByDisc.find(c => c.id === Number(selCat))?.code : null,
      categoryName: selCat ? catsByDisc.find(c => c.id === Number(selCat))?.name : null,
      subcategoryId: selSub ? Number(selSub) : null,
      subcategoryCode: selSub ? subsByCat.find(s => s.id === Number(selSub))?.code : null,
      subcategoryName: selSub ? subsByCat.find(s => s.id === Number(selSub))?.name : null,
    }
    const exists = taxonomyRows.some(r =>
      r.disciplineId === item.disciplineId &&
      (r.categoryId ?? null) === (item.categoryId ?? null) &&
      (r.subcategoryId ?? null) === (item.subcategoryId ?? null)
    )
    if (exists) {
      toaster.error({ title: 'Esa combinación ya está agregada' })
      return
    }
    setTaxonomyRows(prev => [...prev, item])
  }

  const onRemoveTaxonomy = (idx) => {
    setTaxonomyRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function onSaveHeader() {
    setSaving(true)
    try {
      await TestsApi.update(id, {
        name: form.name,
        description: form.description,
        instructions: form.instructions,
        ageGroupId: form.ageGroupId,
        isActive: form.isActive,
        pdfUrl: form.pdfUrl || null,
      })
      toaster.success({ title: 'Test actualizado' })
      await loadTest()
    } catch (error) {
      toaster.error({ title: 'Error al guardar', description: getErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  // <- NUEVO: incluir selección pendiente si no está en la grilla
  const canSaveTaxonomy = taxonomyRows.length > 0 || !!selDisc

  async function onSaveTaxonomy() {
    try {
      // payload desde grilla
      const baseItems = taxonomyRows.map(r => ({
        disciplineId: r.disciplineId,
        categoryId: r.categoryId ?? null,
        subcategoryId: r.subcategoryId ?? null,
      }))

      // selección pendiente (si hay disciplina)
      const pending = selDisc ? [{
        disciplineId: Number(selDisc),
        categoryId: selCat ? Number(selCat) : null,
        subcategoryId: selSub ? Number(selSub) : null,
      }] : []

      // merge único
      const all = [...baseItems, ...pending].filter((it, idx, arr) =>
        idx === arr.findIndex(x =>
          x.disciplineId === it.disciplineId &&
          (x.categoryId ?? null) === (it.categoryId ?? null) &&
          (x.subcategoryId ?? null) === (it.subcategoryId ?? null)
        )
      )

      if (all.length === 0) {
        toaster.error({ title: 'No hay nada para guardar' })
        return
      }

      await TestsApi.replaceTaxonomy(id, all)
      toaster.success({ title: 'Taxonomía actualizada' })

      // limpiar selección y recargar grilla desde API
      setSelDisc(''); setSelCat(''); setSelSub('')
      await loadTaxonomy()
    } catch (e) {
      toaster.error({ title: 'No se pudo guardar taxonomía', description: getErrorMessage(e) })
    }
  }

  return (
    <Box>
      {/* Toolbar superior */}
      <HStack mb="4" align="center" wrap="wrap">
        <Tip label="Volver">
          <Button size="sm" onClick={() => navigate('/app/tests')} leftIcon={<FiChevronLeft />}>
            Volver
          </Button>
        </Tip>
        <Heading size="md">Editor de Test</Heading>
        <Spacer />
        <HStack>
          <Tip label="Recargar">
            <IconButton size="sm" onClick={() => { loadTest(); loadTaxonomy(); }} aria-label="Recargar">
              <FiRefreshCw />
            </IconButton>
          </Tip>
          <Button size="sm" colorPalette="blue" onClick={onSaveHeader} leftIcon={<FiSave />} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar encabezado'}
          </Button>
        </HStack>
      </HStack>

      {/* Encabezado editable */}
      <Box borderWidth="1px" borderRadius="md" p="4" mb="4">
        {loading ? (
          <HStack py="3" color="fg.muted"><Spinner /><Text>Cargando…</Text></HStack>
        ) : (
          <VStack align="stretch" gap="3">
            <HStack gap="3" wrap="wrap">
              <Box flex="1 1 320px">
                <Text textStyle="sm" color="fg.muted" mb="1">Código (solo lectura)</Text>
                <Input value={form.code} readOnly />
              </Box>
              <Box flex="2 1 420px">
                <Text textStyle="sm" color="fg.muted" mb="1">Nombre</Text>
                <Input
                  value={form.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  placeholder="Nombre del test"
                />
              </Box>
            </HStack>

            <HStack gap="3" wrap="wrap">
              <Box flex="1 1 240px">
                <Text textStyle="sm" color="fg.muted" mb="1">Grupo etario</Text>
                <select
                  value={hasSelected ? form.ageGroupId : ''}
                  onChange={(e) => onChange('ageGroupId', e.target.value)}
                  style={{ padding: '8px', width: '100%', borderRadius: 6, border: '1px solid var(--chakra-colors-border)' }}
                >
                  {!hasSelected && form.ageGroupId && (
                    <option value="" disabled>
                      (Grupo actual no listado o inactivo)
                    </option>
                  )}
                  <option value="">Seleccione…</option>
                  {ageGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.name}
                    </option>
                  ))}
                </select>
              </Box>
              <Box flex="1 1 200px">
                <Text textStyle="sm" color="fg.muted" mb="1">Estado</Text>
                <Switch.Root
                  checked={!!form.isActive}
                  onCheckedChange={(e) => onChange('isActive', e.checked)}
                >
                  <HStack>
                    <Switch.Control />
                    <Text>{form.isActive ? 'Activo' : 'Inactivo'}</Text>
                  </HStack>
                </Switch.Root>
              </Box>
              <Box flex="2 1 360px">
                <Text textStyle="sm" color="fg.muted" mb="1">PDF (URL)</Text>
                <Input
                  value={form.pdfUrl || ''}
                  onChange={(e) => onChange('pdfUrl', e.target.value)}
                  placeholder="/uploads/tests/archivo.pdf"
                />
              </Box>
            </HStack>

            <Box>
              <Text textStyle="sm" color="fg.muted" mb="1">Descripción</Text>
              <Textarea
                rows={3}
                value={form.description || ''}
                onChange={(e) => onChange('description', e.target.value)}
              />
            </Box>

            <Box>
              <Text textStyle="sm" color="fg.muted" mb="1">Instrucciones</Text>
              <Textarea
                rows={4}
                value={form.instructions || ''}
                onChange={(e) => onChange('instructions', e.target.value)}
              />
            </Box>
          </VStack>
        )}
      </Box>

      {/* Taxonomía */}
      <Box borderWidth="1px" borderRadius="md" p="4" mb="4">
        <HStack justify="space-between" wrap="wrap" mb="3">
          <Text fontWeight="600">Taxonomía (Disciplina / Categoría / Subcategoría)</Text>
          <Button size="sm" onClick={onSaveTaxonomy} leftIcon={<FiSave />} disabled={!canSaveTaxonomy}>
            Guardar taxonomía
          </Button>
        </HStack>

        {/* Picker dependiente */}
        <HStack gap="3" wrap="wrap" mb="3">
          <Box minW="220px" flex="1">
            <Text textStyle="sm" color="fg.muted" mb="1">Disciplina</Text>
            <select
              value={selDisc}
              onChange={(e) => { setSelDisc(e.target.value); setSelCat(''); setSelSub(''); }}
              style={{ padding: '8px', width: '100%', borderRadius: 6, border: '1px solid var(--chakra-colors-border)' }}
            >
              <option value="">Seleccione…</option>
              {disciplines.map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </Box>
          <Box minW="220px" flex="1">
            <Text textStyle="sm" color="fg.muted" mb="1">Categoría (opcional)</Text>
            <select
              value={selCat}
              onChange={(e) => { setSelCat(e.target.value); setSelSub(''); }}
              style={{ padding: '8px', width: '100%', borderRadius: 6, border: '1px solid var(--chakra-colors-border)' }}
              disabled={!selDisc}
            >
              <option value="">—</option>
              {catsByDisc.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </Box>
          <Box minW="240px" flex="1">
            <Text textStyle="sm" color="fg.muted" mb="1">Subcategoría (opcional)</Text>
            <select
              value={selSub}
              onChange={(e) => setSelSub(e.target.value)}
              style={{ padding: '8px', width: '100%', borderRadius: 6, border: '1px solid var(--chakra-colors-border)' }}
              disabled={!selCat}
            >
              <option value="">—</option>
              {subsByCat.map(s => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </Box>

          <Tip label="Agregar fila a la grilla">
            <IconButton aria-label="Agregar" onClick={onAddTaxonomy}>
              <FiPlus />
            </IconButton>
          </Tip>
        </HStack>

        {/* Grilla actual */}
        <Box borderWidth="1px" borderRadius="md" overflow="hidden">
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader minW="220px">Disciplina</Table.ColumnHeader>
                <Table.ColumnHeader minW="220px">Categoría</Table.ColumnHeader>
                <Table.ColumnHeader minW="240px">Subcategoría</Table.ColumnHeader>
                <Table.ColumnHeader minW="100px">Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {taxonomyRows.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Box py="6" textAlign="center" color="fg.muted">Sin asignaciones</Box>
                  </Table.Cell>
                </Table.Row>
              ) : (
                taxonomyRows.map((r, idx) => (
                  <Table.Row key={`${r.disciplineId}-${r.categoryId ?? 'x'}-${r.subcategoryId ?? 'x'}-${idx}`}>
                    <Table.Cell>
                      <Text><b>{r.disciplineCode}</b> — {r.disciplineName}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {r.categoryId ? (<Text><b>{r.categoryCode}</b> — {r.categoryName}</Text>) : <Text color="fg.muted">—</Text>}
                    </Table.Cell>
                    <Table.Cell>
                      {r.subcategoryId ? (<Text><b>{r.subcategoryCode}</b> — {r.subcategoryName}</Text>) : <Text color="fg.muted">—</Text>}
                    </Table.Cell>
                    <Table.Cell>
                      <Tip label="Quitar">
                        <IconButton aria-label="Quitar" size="sm" onClick={() => onRemoveTaxonomy(idx)}>
                          <FiTrash2 />
                        </IconButton>
                      </Tip>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>

      {/* Tabs v3: Preguntas / Escalas */}
      <Tabs.Root defaultValue="questions">
        <Tabs.List>
          <Tabs.Trigger value="questions">Preguntas</Tabs.Trigger>
          <Tabs.Trigger value="scales">Escalas</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="questions" pt="3">
          <QuestionsTab testId={id} />
        </Tabs.Content>

        <Tabs.Content value="scales" pt="3">
          <ScalesTab testId={id} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
