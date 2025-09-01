// src/pages/admin/TestDetailPage.jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Heading, HStack, Button, Badge, Text, Spinner,
  Tabs, Table, Link, Separator
} from '@chakra-ui/react'
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi'
import { TestsApi } from '../../api/testsApi'
import { toaster } from '../../components/ui/toaster'
import client from '../../api/client'

function getErrorMessage(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data?.message) return data.message
  return error?.message || 'Error'
}

function toApiUrl(u) {
  if (!u) return null
  try {
    return new URL(u, client.defaults.baseURL).href
  } catch {
    return u
  }
}

export default function TestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [header, setHeader] = useState(null)   // TestDetail
  const [questions, setQuestions] = useState([]) // TestQuestionRow[]
  const [scales, setScales] = useState([])       // TestScaleRow[]

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const [h, qs, sc] = await Promise.all([
          TestsApi.getById(id),
          TestsApi.getQuestions(id),
          TestsApi.getScales(id),
        ])
        if (!alive) return
        setHeader(h)
        setQuestions(qs || [])
        setScales(sc || [])
      } catch (err) {
        console.error(err)
        toaster.error({ title: 'No se pudo cargar el test', description: getErrorMessage(err) })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [id])

  if (loading) {
    return (
      <Box p={6}>
        <HStack><Spinner /><Text>Cargando…</Text></HStack>
      </Box>
    )
  }

  if (!header) {
    return (
      <Box p={6}>
        <HStack mb={4}>
          <Button leftIcon={<FiArrowLeft />} onClick={() => navigate('/app/tests')}>
            Volver
          </Button>
        </HStack>
        <Text>No encontrado.</Text>
      </Box>
    )
  }

  const pdfHref = toApiUrl(header.pdfUrl)

  return (
    <Box p={6}>
      <HStack mb={3} justify="space-between" wrap="wrap" gap="2">
        <HStack>
          <Button leftIcon={<FiArrowLeft />} onClick={() => navigate('/app/tests')}>
            Volver
          </Button>
          <Heading size="md">{header.name}</Heading>
        </HStack>
        <HStack>
          <Badge colorPalette={header.isActive ? 'green' : 'gray'}>
            {header.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
          <Badge>{header.ageGroupName}</Badge>
          {pdfHref ? (
            <Link href={pdfHref} isExternal title="Abrir PDF">
              <HStack as="span" gap="1">
                <FiExternalLink /> <Text textStyle="xs">PDF</Text>
              </HStack>
            </Link>
          ) : null}
        </HStack>
      </HStack>

      <Text color="fg.muted" fontSize="sm">{header.code}</Text>
      {header.description && <Text mt={2}>{header.description}</Text>}
      <HStack mt={3} color="fg.muted" fontSize="sm" gap="6">
        <Text><b>Preguntas:</b> {header.questionCount}</Text>
        <Text><b>Escalas:</b> {header.scaleCount}</Text>
        <Text><b>Actualización:</b> {new Date(header.updatedAt || header.createdAt).toLocaleString()}</Text>
      </HStack>

      <Separator my="4" />

      {/* --- TABS Chakra v3 --- */}
      <Tabs.Root defaultValue="questions">
        <Tabs.List>
          <Tabs.Trigger value="questions">Preguntas ({questions.length})</Tabs.Trigger>
          <Tabs.Trigger value="scales">Escalas ({scales.length})</Tabs.Trigger>
          <Tabs.Trigger value="meta">Metadatos</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="questions">
          <Table.Root size="sm" variant="outline" mt="4">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader minW="80px">Orden</Table.ColumnHeader>
                <Table.ColumnHeader minW="100px">Código</Table.ColumnHeader>
                <Table.ColumnHeader>Texto</Table.ColumnHeader>
                <Table.ColumnHeader minW="120px">Tipo</Table.ColumnHeader>
                <Table.ColumnHeader minW="90px">Opcional</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {questions.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5}>
                    <Box py="6" textAlign="center" color="fg.muted">Sin preguntas</Box>
                  </Table.Cell>
                </Table.Row>
              ) : (
                questions.map(q => (
                  <Table.Row key={q.id}>
                    <Table.Cell>{q.orderNo}</Table.Cell>
                    <Table.Cell><Text fontWeight="600">{q.code}</Text></Table.Cell>
                    <Table.Cell>{q.text}</Table.Cell>
                    <Table.Cell>{q.questionType}</Table.Cell>
                    <Table.Cell>{q.isOptional ? 'Sí' : 'No'}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Tabs.Content>

        <Tabs.Content value="scales">
          <Table.Root size="sm" variant="outline" mt="4">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader minW="140px">Código</Table.ColumnHeader>
                <Table.ColumnHeader>Nombre</Table.ColumnHeader>
                <Table.ColumnHeader minW="120px"># Ítems</Table.ColumnHeader>
                <Table.ColumnHeader>Descripción</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {scales.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Box py="6" textAlign="center" color="fg.muted">Sin escalas</Box>
                  </Table.Cell>
                </Table.Row>
              ) : (
                scales.map(s => (
                  <Table.Row key={s.id}>
                    <Table.Cell><Text fontWeight="600">{s.code}</Text></Table.Cell>
                    <Table.Cell>{s.name}</Table.Cell>
                    <Table.Cell>{s.questionCount}</Table.Cell>
                    <Table.Cell>{s.description || '—'}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Tabs.Content>

        <Tabs.Content value="meta">
          <Box mt="4">
            {header.instructions && (
              <>
                <Heading size="sm" mb={2}>Instrucciones</Heading>
                <Text whiteSpace="pre-wrap">{header.instructions}</Text>
                <Separator my="3" />
              </>
            )}
            {header.example && (
              <>
                <Heading size="sm" mb={2}>Ejemplo</Heading>
                <Text whiteSpace="pre-wrap">{header.example}</Text>
                <Separator my="3" />
              </>
            )}
            <Text color="fg.muted" fontSize="sm">ID: {header.id}</Text>
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
