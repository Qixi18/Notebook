import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, matchPath, Route, Routes, useLocation } from 'react-router-dom'

import { ApiError, api } from './api'
import { AppLayout, WorkspaceProvider, type ChatMessage } from './components/AppLayout'
import { CourseRouteGuard } from './components/CourseGate'
import { AssistantPage } from './pages/AssistantPage'
import { CourseOverviewPage } from './pages/CourseOverviewPage'
import { HomePage } from './pages/HomePage'
import { KnowledgeTreePage } from './pages/KnowledgeTreePage'
import { MaterialsPage } from './pages/MaterialsPage'
import { NotesPage } from './pages/NotesPage'
import type { Course, Job, KnowledgeGraph, Material, Note, Page } from './types'

const emptyGraph: KnowledgeGraph = { nodes: [], edges: [] }

function NotFoundPage() {
  return (
    <section className="route-state-card">
      <span className="route-state-symbol">404</span>
      <h1>没有找到这个页面</h1>
      <p>请从首页选择课程和功能。</p>
      <Link className="primary-button link-button" to="/">返回首页</Link>
    </section>
  )
}

function App() {
  const location = useLocation()
  const courseId = matchPath('/courses/:courseId/*', location.pathname)?.params.courseId
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [courseContentLoading, setCourseContentLoading] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>()
  const [pages, setPages] = useState<Page[]>([])
  const [selectedPageNumber, setSelectedPageNumber] = useState<number>()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string>()
  const [noteDraft, setNoteDraft] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [graph, setGraph] = useState<KnowledgeGraph>(emptyGraph)
  const [job, setJob] = useState<Job>()
  const [busy, setBusy] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [question, setQuestion] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好，我会优先从当前课程已解析的页面中寻找回答依据。',
    },
  ])

  const course = courses.find((item) => item.id === courseId)
  const selectedNote = notes.find((note) => note.id === selectedNoteId)

  const refreshCourses = useCallback(async () => {
    try {
      setCoursesLoading(true)
      setCourses(await api.listCourses())
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程读取失败')
    } finally {
      setCoursesLoading(false)
    }
  }, [])

  const refreshMaterials = useCallback(async (id: string) => {
    const next = await api.listMaterials(id)
    setMaterials(next)
    setSelectedMaterialId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id)
  }, [])

  const refreshPages = useCallback(async (id: string) => {
    const next = await api.listPages(id)
    setPages(next)
    setSelectedPageNumber((current) => current && next.some((page) => page.page_number === current) ? current : next[0]?.page_number)
  }, [])

  const refreshNotes = useCallback(async (id: string) => {
    const next = await api.listNotes(id)
    setNotes(next)
    setSelectedNoteId((current) => current && next.some((note) => note.id === current) ? current : next[0]?.id)
  }, [])

  const refreshGraph = useCallback(async (id: string) => {
    setGraph(await api.getKnowledgeGraph(id))
  }, [])

  useEffect(() => { void refreshCourses() }, [refreshCourses])

  useEffect(() => {
    let active = true
    setMaterials([])
    setPages([])
    setNotes([])
    setGraph(emptyGraph)
    setSelectedMaterialId(undefined)
    setSelectedPageNumber(undefined)
    setSelectedNoteId(undefined)
    setJob(undefined)
    setMessages([{ role: 'assistant', content: '你好，我会优先从当前课程已解析的页面中寻找回答依据。' }])
    setQuestion('')
    setCourseContentLoading(Boolean(courseId))

    if (!courseId) return () => { active = false }

    void Promise.all([
      api.listMaterials(courseId),
      api.listNotes(courseId),
      api.getKnowledgeGraph(courseId),
    ]).then(([nextMaterials, nextNotes, nextGraph]) => {
      if (!active) return
      setMaterials(nextMaterials)
      setSelectedMaterialId(nextMaterials[0]?.id)
      setNotes(nextNotes)
      setSelectedNoteId(nextNotes[0]?.id)
      setGraph(nextGraph)
      setError(undefined)
      setCourseContentLoading(false)
    }).catch((cause: unknown) => {
      if (!active) return
      setCourseContentLoading(false)
      const message = cause instanceof Error ? cause.message : '课程内容读取失败'
      if (message.includes('课程不存在')) {
        setError(undefined)
        return
      }
      setError(message)
    })

    return () => { active = false }
  }, [courseId])

  useEffect(() => {
    let active = true
    setPages([])
    setSelectedPageNumber(undefined)
    if (!selectedMaterialId) return () => { active = false }
    void refreshPages(selectedMaterialId).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : '页面读取失败')
    })
    return () => { active = false }
  }, [selectedMaterialId, refreshPages])

  useEffect(() => {
    setNoteDraft(selectedNote?.content_markdown ?? '')
    setEditingNote(false)
  }, [selectedNote?.id, selectedNote?.content_markdown])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return
    let active = true
    const timer = window.setInterval(() => {
      void api.getJob(job.id).then(async (nextJob) => {
        if (!active) return
        setJob(nextJob)
        if ((nextJob.status === 'completed' || nextJob.status === 'failed') && courseId) {
          const refreshes = [refreshMaterials(courseId)]
          if (nextJob.status === 'completed') refreshes.push(refreshNotes(courseId), refreshGraph(courseId))
          await Promise.all(refreshes)
        }
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : '任务状态读取失败')
      })
    }, 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [job, courseId, refreshMaterials, refreshNotes, refreshGraph])

  async function createCourse(name: string): Promise<Course> {
    const created = await api.createCourse(name)
    setCourses((current) => [created, ...current.filter((item) => item.id !== created.id)])
    return created
  }

  async function uploadMaterial(file: File, lectureTitle: string) {
    if (!courseId) throw new Error('请先选择课程')
    try {
      setBusy(true)
      setError(undefined)
      const result = await api.uploadMaterial(courseId, file, lectureTitle)
      setJob(result.job)
      setSelectedMaterialId(result.material.id)
      await refreshMaterials(courseId)
      setSelectedMaterialId(result.material.id)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '资料上传失败'
      setError(message)
      throw cause
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    if (!selectedNote) return
    try {
      setNoteSaving(true)
      const updated = await api.updateNote(selectedNote.id, noteDraft, selectedNote.revision_number)
      setNotes((current) => current.map((note) => note.id === updated.id ? updated : note))
      setNoteDraft(updated.content_markdown)
      setEditingNote(false)
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 409
        ? '这条笔记已在其他操作中更新。你的修改仍保留在编辑框里，请先复制保存，再刷新页面载入最新版本并手动合并。'
        : cause instanceof Error ? cause.message : '笔记保存失败')
    } finally {
      setNoteSaving(false)
    }
  }

  async function askQuestion() {
    const currentQuestion = question.trim()
    if (!courseId || !currentQuestion || assistantBusy) return
    setMessages((current) => [...current, { role: 'user', content: currentQuestion }])
    setQuestion('')
    setAssistantBusy(true)
    try {
      const response = await api.askAssistant(courseId, currentQuestion, selectedMaterialId, selectedPageNumber)
      setMessages((current) => [...current, { role: 'assistant', content: response.answer, sources: response.sources, mode: response.mode, status: 'explaining' }])
    } catch (cause) {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: cause instanceof Error ? cause.message : '问答请求失败',
        status: 'error',
      }])
    } finally {
      setAssistantBusy(false)
    }
  }

  const workspace = useMemo(() => ({
    courses,
    courseId,
    course,
    coursesLoading,
    courseContentLoading,
    materials,
    selectedMaterialId,
    setSelectedMaterialId,
    pages,
    selectedPageNumber,
    setSelectedPageNumber,
    notes,
    selectedNote,
    setSelectedNoteId,
    noteDraft,
    setNoteDraft,
    editingNote,
    setEditingNote,
    graph,
    job,
    busy: busy || assistantBusy,
    assistantBusy,
    noteSaving,
    error,
    setError,
    createCourse,
    uploadMaterial,
    saveNote,
    messages,
    question,
    setQuestion,
    askQuestion,
    refreshCourses,
  }), [courses, courseId, course, coursesLoading, courseContentLoading, materials, selectedMaterialId, pages, selectedPageNumber, notes, selectedNote, noteDraft, editingNote, graph, job, busy, assistantBusy, noteSaving, error, createCourse, uploadMaterial, saveNote, messages, question, askQuestion, refreshCourses])

  return (
    <WorkspaceProvider value={workspace}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/courses/:courseId" element={<CourseRouteGuard><CourseOverviewPage /></CourseRouteGuard>} />
          <Route path="/courses/:courseId/notes" element={<CourseRouteGuard><NotesPage /></CourseRouteGuard>} />
          <Route path="/courses/:courseId/knowledge-tree" element={<CourseRouteGuard><KnowledgeTreePage /></CourseRouteGuard>} />
          <Route path="/courses/:courseId/materials" element={<CourseRouteGuard><MaterialsPage /></CourseRouteGuard>} />
          <Route path="/courses/:courseId/assistant" element={<CourseRouteGuard><AssistantPage /></CourseRouteGuard>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  )
}

export default App
