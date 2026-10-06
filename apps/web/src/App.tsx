import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import { api } from './api'
import {
  CourseContextMenu,
  DeleteCourseDialog,
  RenameCourseDialog,
} from './CourseContextMenu'
import type { ContextMenuState } from './CourseContextMenu'
import { SettingsPanel } from './SettingsPanel'
import type {
  AssistantSource,
  Course,
  Job,
  KnowledgeGraph,
  Material,
  Note,
  Page,
} from './types'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantSource[]
}

const statusLabels: Record<string, string> = {
  pending: '等待解析',
  processing: '解析中',
  completed: '已完成',
  failed: '解析失败',
}

type TechIconName =
  | 'brand'
  | 'overview'
  | 'materials'
  | 'pages'
  | 'nodes'
  | 'sources'
  | 'note'
  | 'chat'
  | 'settings'
  | 'refresh'
  | 'spark'
  | 'send'

function TechIcon({ name, size = 20 }: { name: TechIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  const paths: Record<TechIconName, ReactNode> = {
    brand: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M8 16V8l8 8V8" /></>,
    overview: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12h8M8 8h5M8 16h4" /><circle cx="17" cy="8" r="1" /></>,
    materials: <><path d="M5 6.5h5l1.5 2H19a2 2 0 0 1 2 2v6A2 2 0 0 1 19 18.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" /><path d="M3 10h18" /></>,
    pages: <><rect x="5" y="3.5" width="12" height="15" rx="2" /><path d="M9 7.5h4M9 11h5M9 14.5h3" /><path d="M17 7h2a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H9.5A1.5 1.5 0 0 1 8 19v-.5" /></>,
    nodes: <><circle cx="6" cy="7" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="17" r="2.2" /><path d="m7.8 8.2 2.4 6.2M16.1 7.7l-2.5 6.7M8.2 7.2h7.6" /></>,
    sources: <><path d="M8.5 6.5h7a3 3 0 1 1 0 6h-3" /><path d="M15.5 17.5h-7a3 3 0 1 1 0-6h3" /><path d="m9.5 12 5-5M9.5 12l5 5" /></>,
    note: <><path d="M6 3.5h9l3 3v14H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" /><path d="M15 3.5v4h4M8 11h6M8 15h8" /></>,
    chat: <><path d="M5.5 5.5h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-8l-4.5 3v-3.4A2.5 2.5 0 0 1 3.5 15V8a2.5 2.5 0 0 1 2-2.5Z" /><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.2 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-4.2L3 9" /><path d="M3 4v5h5M4 13a8 8 0 0 0 14.7 4.2L21 15" /><path d="M21 20v-5h-5" /></>,
    spark: <><path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z" /><path d="m19 15 .5 2.5L22 18l-2.5.5L19 21l-.5-2.5L16 18l2.5-.5L19 15Z" /></>,
    send: <><path d="m21 3-7.4 18-3.3-7.3L3 10.4 21 3Z" /><path d="m10.3 13.7 4.1-4.1" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}

function App() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>()
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>()
  const [pages, setPages] = useState<Page[]>([])
  const [selectedPageNumber, setSelectedPageNumber] = useState<number>()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string>()
  const [noteDraft, setNoteDraft] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [activeView, setActiveView] = useState<'notes' | 'graph'>('notes')
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], edges: [] })
  const [newCourseName, setNewCourseName] = useState('')
  const [uploadFile, setUploadFile] = useState<File>()
  const [lectureTitle, setLectureTitle] = useState('第 1 讲')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好，我现在处于本地检索预览模式。上传一份 PPT 后，我会优先从当前课程的已解析页面中寻找依据。',
    },
  ])
  const [job, setJob] = useState<Job>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [courseAction, setCourseAction] = useState<{
    kind: 'rename' | 'delete'
    courseId: string
    courseName: string
  }>()
  const [courseActionSaving, setCourseActionSaving] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState<string>()
  const [error, setError] = useState<string>()

  const selectedCourse = courses.find((course) => course.id === selectedCourseId)
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId)
  const selectedPage = pages.find((page) => page.page_number === selectedPageNumber)
  const selectedNote = notes.find((note) => note.id === selectedNoteId)

  const courseSubtitle = useMemo(() => {
    if (!selectedCourse) return '从左侧创建或选择一门课程'
    return `${materials.length} 份资料 · ${pages.length} 页已加载`
  }, [materials.length, pages.length, selectedCourse])

  useEffect(() => {
    void refreshCourses()
  }, [])

  useEffect(() => {
    if (!selectedCourseId) {
      setMaterials([])
      return
    }
    void refreshMaterials(selectedCourseId)
  }, [selectedCourseId])

  useEffect(() => {
    if (!selectedMaterialId) {
      setPages([])
      return
    }
    void refreshPages(selectedMaterialId)
  }, [selectedMaterialId])

  useEffect(() => {
    if (!selectedCourseId) {
      setNotes([])
      setGraph({ nodes: [], edges: [] })
      return
    }
    void refreshNotes(selectedCourseId)
    void refreshGraph(selectedCourseId)
  }, [selectedCourseId])

  useEffect(() => {
    setNoteDraft(selectedNote?.content_markdown ?? '')
    setEditingNote(false)
  }, [selectedNoteId, selectedNote?.content_markdown])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return
    const timer = window.setInterval(async () => {
      try {
        const nextJob = await api.getJob(job.id)
        setJob(nextJob)
        if (nextJob.status === 'completed' && selectedMaterialId) {
          await refreshPages(selectedMaterialId)
          if (selectedCourseId) await refreshMaterials(selectedCourseId)
          if (selectedCourseId) {
            await refreshNotes(selectedCourseId)
            await refreshGraph(selectedCourseId)
          }
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '任务状态读取失败')
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [job, selectedCourseId, selectedMaterialId])

  async function refreshCourses() {
    try {
      setLoading(true)
      const nextCourses = await api.listCourses()
      setCourses(nextCourses)
      setSelectedCourseId((current) => current ?? nextCourses[0]?.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程读取失败')
    } finally {
      setLoading(false)
    }
  }

  async function refreshMaterials(courseId: string) {
    try {
      const nextMaterials = await api.listMaterials(courseId)
      setMaterials(nextMaterials)
      setSelectedMaterialId((current) =>
        current && nextMaterials.some((material) => material.id === current)
          ? current
          : nextMaterials[0]?.id,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程资料读取失败')
    }
  }

  async function refreshPages(materialId: string) {
    try {
      const nextPages = await api.listPages(materialId)
      setPages(nextPages)
      setSelectedPageNumber((current) => current ?? nextPages[0]?.page_number)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '页面读取失败')
    }
  }

  async function refreshNotes(courseId: string) {
    try {
      const nextNotes = await api.listNotes(courseId)
      setNotes(nextNotes)
      setSelectedNoteId((current) =>
        current && nextNotes.some((note) => note.id === current) ? current : nextNotes[0]?.id,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '笔记读取失败')
    }
  }

  async function refreshGraph(courseId: string) {
    try {
      setGraph(await api.getKnowledgeGraph(courseId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '知识树读取失败')
    }
  }

  async function handleSaveNote() {
    if (!selectedNote) return
    try {
      setNoteSaving(true)
      const updated = await api.updateNote(
        selectedNote.id,
        noteDraft,
        selectedNote.revision_number,
      )
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
      setNoteDraft(updated.content_markdown)
      setEditingNote(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '笔记保存失败')
    } finally {
      setNoteSaving(false)
    }
  }

  async function handleRenameCourse(name: string) {
    if (!courseAction) return
    try {
      setCourseActionSaving(true)
      setError(undefined)
      const updated = await api.renameCourse(courseAction.courseId, name)
      setCourses((current) =>
        current.map((course) => (course.id === updated.id ? updated : course)),
      )
      setCourseAction(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程重命名失败')
    } finally {
      setCourseActionSaving(false)
    }
  }

  async function handleDeleteCourse() {
    if (!courseAction) return
    const removedId = courseAction.courseId
    try {
      setCourseActionSaving(true)
      setError(undefined)
      const result = await api.deleteCourse(removedId)
      const remaining = courses.filter((course) => course.id !== removedId)
      const removedName = courseAction.courseName
      setCourses(remaining)
      // 被删的若是当前课程，切到列表里的下一门，否则清空工作区
      if (selectedCourseId === removedId) {
        setSelectedCourseId(remaining[0]?.id)
        setMaterials([])
        setPages([])
        setNotes([])
        setGraph({ nodes: [], edges: [] })
        setSelectedMaterialId(undefined)
        setSelectedPageNumber(undefined)
        setSelectedNoteId(undefined)
        setJob(undefined)
      }
      setCourseAction(undefined)
      setDeleteNotice(
        `已删除「${removedName}」：${result.deleted_materials} 份资料、${result.deleted_pages} 页、${result.deleted_knowledge_nodes} 个知识点、${result.deleted_notes} 条笔记`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程删除失败')
    } finally {
      setCourseActionSaving(false)
    }
  }

  async function handleCreateCourse(event: FormEvent) {
    event.preventDefault()
    if (!newCourseName.trim()) return
    try {
      setBusy(true)
      const course = await api.createCourse(newCourseName.trim())
      setCourses((current) => [course, ...current])
      setSelectedCourseId(course.id)
      setNewCourseName('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程创建失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (!selectedCourseId || !uploadFile) return
    try {
      setBusy(true)
      setError(undefined)
      const result = await api.uploadMaterial(selectedCourseId, uploadFile, lectureTitle)
      setJob(result.job)
      setUploadFile(undefined)
      await refreshMaterials(selectedCourseId)
      setSelectedMaterialId(result.material.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '资料上传失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleAsk(event: FormEvent) {
    event.preventDefault()
    if (!selectedCourseId || !question.trim()) return
    const currentQuestion = question.trim()
    setMessages((current) => [...current, { role: 'user', content: currentQuestion }])
    setQuestion('')
    try {
      const response = await api.askAssistant(
        selectedCourseId,
        currentQuestion,
        selectedMaterialId,
        selectedPageNumber,
      )
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.answer, sources: response.sources },
      ])
    } catch (cause) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: cause instanceof Error ? cause.message : '问答请求失败',
        },
      ])
    }
  }

  function focusWorkspaceSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <aside className="icon-rail" aria-label="主导航">
        <div className="brand-mark" title="NoteBuddy">
          <TechIcon name="brand" size={21} />
        </div>
        <button className={`rail-button ${activeView === 'notes' ? 'rail-button-active' : ''}`} title="核心笔记" aria-label="查看核心笔记" onClick={() => setActiveView('notes')}>
          <TechIcon name="note" />
        </button>
        <button className={`rail-button ${activeView === 'graph' ? 'rail-button-active' : ''}`} title="知识节点" aria-label="查看知识节点" onClick={() => setActiveView('graph')}>
          <TechIcon name="nodes" />
        </button>
        <button className="rail-button" title="课程资料" aria-label="定位到课程资料" onClick={() => focusWorkspaceSection('course-materials')}>
          <TechIcon name="materials" />
        </button>
        <button
          className={`rail-button rail-button-bottom ${settingsOpen ? 'rail-button-active' : ''}`}
          title="设置"
          aria-label="打开设置"
          onClick={() => setSettingsOpen(true)}
        >
          <TechIcon name="settings" />
        </button>
      </aside>

      <aside className="course-sidebar">
        <div className="sidebar-heading">
          <div>
            <span className="eyebrow">NOTE BUDDY</span>
            <h1>我的课程</h1>
          </div>
          <span className="count-badge">{courses.length}</span>
        </div>

        <form className="create-course" onSubmit={handleCreateCourse}>
          <input
            value={newCourseName}
            onChange={(event) => setNewCourseName(event.target.value)}
            placeholder="输入课程名称"
            aria-label="新课程名称"
          />
          <button type="submit" disabled={busy || !newCourseName.trim()}>+</button>
        </form>

        <div className="course-list">
          {loading && <div className="muted-block">正在读取课程…</div>}
          {!loading && courses.length === 0 && (
            <div className="empty-block">还没有课程。先创建一门课程，再上传第一讲 PPT。</div>
          )}
          {courses.map((course) => (
            <button
              className={`course-card ${course.id === selectedCourseId ? 'course-card-active' : ''}`}
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                setSelectedCourseId(course.id)
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  courseId: course.id,
                  courseName: course.name,
                })
              }}
              title={`${course.name}（右键可重命名或删除）`}
            >
              <span className="course-icon"><TechIcon name="overview" size={17} /></span>
              <span>
                <strong>{course.name}</strong>
                <small>{course.id === selectedCourseId ? '当前课程' : '打开课程'}</small>
              </span>
            </button>
          ))}
        </div>

        <nav className="course-workbench-nav" aria-label="当前课程目录">
          <div className="sidebar-nav-heading">
            <span>当前课程</span>
            {selectedCourse && <small>{selectedCourse.name}</small>}
          </div>
          <button className="sidebar-nav-item" onClick={() => focusWorkspaceSection('workspace-top')}>
            <TechIcon name="overview" size={18} /><span>课程总览</span>
          </button>
          <button className="sidebar-nav-item" onClick={() => focusWorkspaceSection('course-materials')}>
            <TechIcon name="materials" size={18} /><span>课程资料</span><small>{materials.length}</small>
          </button>
          <button className="sidebar-nav-item" onClick={() => focusWorkspaceSection('page-preview')}>
            <TechIcon name="pages" size={18} /><span>解析页面</span><small>{pages.length}</small>
          </button>
          <button className={`sidebar-nav-item ${activeView === 'graph' ? 'sidebar-nav-item-active' : ''}`} onClick={() => setActiveView('graph')}>
            <TechIcon name="nodes" size={18} /><span>知识节点</span><small>{graph.nodes.length}</small>
          </button>
          <button className="sidebar-nav-item" onClick={() => focusWorkspaceSection('source-reference')}>
            <TechIcon name="sources" size={18} /><span>来源引用</span>
          </button>
          <button className={`sidebar-nav-item ${activeView === 'notes' ? 'sidebar-nav-item-active' : ''}`} onClick={() => setActiveView('notes')}>
            <TechIcon name="note" size={18} /><span>核心笔记</span><small>{notes.length}</small>
          </button>
          <button className="sidebar-nav-item" onClick={() => focusWorkspaceSection('course-assistant')}>
            <TechIcon name="chat" size={18} /><span>课程问答</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" /> 本地 Demo · 数据保存在本机
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">NOTE BUDDY / LOCAL LEARNING SPACE</span>
            <h2>{selectedCourse?.name ?? '开始建立你的第一门课程'}</h2>
            <p>{courseSubtitle}</p>
          </div>
          <div className="header-actions">
            <span className="prototype-pill">本地学习空间</span>
            <button className="ghost-button icon-text-button" onClick={() => void refreshCourses()}><TechIcon name="refresh" size={15} />刷新</button>
          </div>
        </header>

        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(undefined)}>关闭</button>
          </div>
        )}

        {deleteNotice && (
          <div className="notice" role="status">
            <span>{deleteNotice}</span>
            <button onClick={() => setDeleteNotice(undefined)}>关闭</button>
          </div>
        )}

        <section className="content-grid">
          <div className="note-column">
            <div className="tab-row">
              <button
                className={`tab ${activeView === 'notes' ? 'tab-active' : ''}`}
                onClick={() => setActiveView('notes')}
              >
                核心笔记
              </button>
              <button
                className={`tab ${activeView === 'graph' ? 'tab-active' : ''}`}
                onClick={() => setActiveView('graph')}
              >
                知识节点
              </button>
            </div>

            <div className="note-card">
              <div className="note-content">
              {!selectedCourse ? (
                <section className="onboarding-card" id="workspace-top">
                  <div className="onboarding-icon"><TechIcon name="spark" size={28} /></div>
                  <span className="eyebrow">从课程到核心笔记</span>
                  <h3>先创建一门课程，开始第一段学习旅程</h3>
                  <p>课程建立后，上传 PPTX 即可逐页解析、提取知识点，并生成可编辑且带来源引用的核心笔记。</p>
                  <div className="onboarding-steps">
                    <div><span>01</span><strong>创建课程</strong><small>在左侧输入课程名称</small></div>
                    <div><span>02</span><strong>上传 PPTX</strong><small>自动进行逐页解析</small></div>
                    <div><span>03</span><strong>阅读与追问</strong><small>查看笔记和引用依据</small></div>
                  </div>
                </section>
              ) : (
                <>
              <div className="note-toolbar" id="workspace-top">
                <div>
                  <span className="eyebrow">当前学习材料</span>
                  <h3>{selectedMaterial?.lecture_title ?? '还没有选择讲次'}</h3>
                </div>
                {selectedMaterial && <span className={`status-chip status-${selectedMaterial.status}`}>{statusLabels[selectedMaterial.status] ?? selectedMaterial.status}</span>}
              </div>

              <form className="upload-panel" onSubmit={handleUpload}>
                <div className="upload-copy">
                  <strong>上传一讲课程资料</strong>
                  <span>初版先验证 PPTX 逐页解析，单文件上限 50 MB。</span>
                </div>
                <input
                  type="text"
                  value={lectureTitle}
                  onChange={(event) => setLectureTitle(event.target.value)}
                  placeholder="讲次标题"
                  aria-label="讲次标题"
                />
                <label className="file-picker">
                  <input
                    type="file"
                    accept=".pptx"
                    onChange={(event) => setUploadFile(event.target.files?.[0])}
                  />
                  {uploadFile?.name ?? '选择 PPTX'}
                </label>
                <button className="primary-button" type="submit" disabled={!selectedCourseId || !uploadFile || busy}>
                  {busy ? '处理中…' : '开始解析'}
                </button>
              </form>

              {job && job.status !== 'completed' && (
                <div className="progress-card">
                  <div className="progress-heading">
                    <span>{statusLabels[job.status] ?? job.status}</span>
                    <span>{job.progress}%</span>
                  </div>
                  <div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div>
                  {job.error_message && <small>{job.error_message}</small>}
                </div>
              )}

              <div className="material-section" id="course-materials">
                <div className="section-heading">
                  <span>课程资料</span>
                  <small>{materials.length} 份</small>
                </div>
                {materials.length === 0 && <div className="empty-block">上传资料后，讲次和解析页面会出现在这里。</div>}
                {materials.map((material) => (
                  <button
                    className={`material-row ${material.id === selectedMaterialId ? 'material-row-active' : ''}`}
                    key={material.id}
                    onClick={() => setSelectedMaterialId(material.id)}
                  >
                    <span className="material-icon"><TechIcon name="materials" size={15} /></span>
                    <span className="material-info">
                      <strong>{material.lecture_title}</strong>
                      <small>{material.original_filename} · {material.page_count} 页</small>
                    </span>
                    <span className={`status-chip status-${material.status}`}>{statusLabels[material.status] ?? material.status}</span>
                  </button>
                ))}
              </div>

              <div className="page-section" id="page-preview">
                <div className="section-heading">
                  <span>逐页解析预览</span>
                  <small>{pages.length} 页</small>
                </div>
                {pages.length === 0 && <div className="empty-block">解析完成后，可以从这里检查页面文本和来源定位。</div>}
                {pages.length > 0 && (
                  <div className="page-list">
                    {pages.map((page) => (
                      <button
                        className={`page-row ${page.page_number === selectedPageNumber ? 'page-row-active' : ''}`}
                        key={page.id}
                        onClick={() => setSelectedPageNumber(page.page_number)}
                      >
                        <span className="page-number">{String(page.page_number).padStart(2, '0')}</span>
                        <span>
                          <strong>{page.title ?? '未识别标题'}</strong>
                          <small>{page.raw_text ? `${page.raw_text.slice(0, 90)}${page.raw_text.length > 90 ? '…' : ''}` : '本页未识别到文本'}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedPage && (
                <article className="page-detail" id="source-reference">
                  <div className="page-detail-heading">
                    <span className="page-number large">第 {selectedPage.page_number} 页</span>
                    <span className="source-tag">来源已定位</span>
                  </div>
                  <h4>{selectedPage.title ?? '未识别标题'}</h4>
                  <p>{selectedPage.raw_text || '本页没有可展示的文本。'}</p>
                  {selectedPage.warning && <div className="warning-note">⚠ {selectedPage.warning}</div>}
                </article>
              )}

              {activeView === 'notes' && (
                <section className="generated-note-section">
                  <div className="section-heading">
                    <span>知识点笔记</span>
                    <small>{notes.length} 条 · 用户修改后自动保护</small>
                  </div>
                  {notes.length === 0 && (
                    <div className="empty-block">解析资料后，系统会根据页面标题和文本生成第一版知识点笔记。</div>
                  )}
                  {notes.length > 0 && (
                    <div className="note-editor-layout">
                      <div className="note-index">
                        {notes.map((note) => (
                          <button
                            className={`note-index-row ${note.id === selectedNoteId ? 'note-index-row-active' : ''}`}
                            key={note.id}
                            onClick={() => setSelectedNoteId(note.id)}
                          >
                            <strong>{note.title}</strong>
                            <small>{note.user_locked ? '用户已锁定' : 'AI 草稿'} · v{note.revision_number}</small>
                          </button>
                        ))}
                      </div>
                      {selectedNote && (
                        <div className="note-editor-card">
                          <div className="note-editor-toolbar">
                            <div>
                              <span className="eyebrow">{selectedNote.content_origin === 'user' ? '用户版本' : 'AI 初稿'}</span>
                              <h4>{selectedNote.title}</h4>
                            </div>
                            {!editingNote && <button className="ghost-button" onClick={() => setEditingNote(true)}>编辑笔记</button>}
                          </div>
                          {editingNote ? (
                            <>
                              <textarea
                                className="note-textarea"
                                value={noteDraft}
                                onChange={(event) => setNoteDraft(event.target.value)}
                                aria-label="笔记 Markdown 内容"
                              />
                              <div className="note-edit-actions">
                                <span>保存后将生成新版本，并阻止 AI 自动覆盖。</span>
                                <div>
                                  <button className="ghost-button" onClick={() => { setNoteDraft(selectedNote.content_markdown); setEditingNote(false) }}>取消</button>
                                  <button className="primary-button" onClick={() => void handleSaveNote()} disabled={noteSaving || !noteDraft.trim()}>{noteSaving ? '保存中…' : '保存并锁定'}</button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="markdown-preview">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {selectedNote.content_markdown}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {activeView === 'graph' && (
                <section className="graph-section">
                  <div className="section-heading">
                    <span>课程知识点</span>
                    <small>{graph.nodes.length} 个节点 · {graph.edges.length} 条关系</small>
                  </div>
                  {graph.nodes.length === 0 && <div className="empty-block">解析资料后，知识点节点会在这里生成。</div>}
                  <div className="graph-node-list">
                    {graph.nodes.map((node) => (
                      <button
                        className="graph-node-card"
                        key={node.id}
                        onClick={() => {
                          const note = notes.find((item) => item.knowledge_node_id === node.id)
                          if (note) { setActiveView('notes'); setSelectedNoteId(note.id) }
                        }}
                      >
                        <strong>{node.name}</strong>
                        <span>{node.summary ?? '暂无摘要'}</span>
                      </button>
                    ))}
                  </div>
                  {graph.edges.length > 0 && (
                    <div className="edge-list">
                      {graph.edges.map((edge) => (
                        <span className="edge-chip" key={edge.id}>{edge.source_node_id.slice(0, 6)} → {edge.target_node_id.slice(0, 6)} · {edge.relation_type}</span>
                      ))}
                    </div>
                  )}
                </section>
              )}
                </>
              )}
              </div>
            </div>
          </div>

          <aside className="assistant-column" id="course-assistant">
            <div className="assistant-header">
              <div className="avatar"><TechIcon name="spark" size={20} /></div>
              <div>
                <span className="eyebrow">课程答疑伙伴</span>
                <h3>AI 学习助手</h3>
              </div>
              <span className="online-dot" />
            </div>
            <div className="assistant-context">
              <span>当前上下文</span>
              <strong>{selectedMaterial?.lecture_title ?? selectedCourse?.name ?? '尚未选择课程'}</strong>
              <small>回答会优先检索已解析页面</small>
            </div>
            <div className="chat-list">
              {messages.map((message, index) => (
                <div className={`chat-message chat-${message.role}`} key={`${message.role}-${index}`}>
                  <span className="chat-label">{message.role === 'assistant' ? 'NoteBuddy' : '你'}</span>
                  <p>{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="source-list">
                      {message.sources.map((source) => (
                        <button
                          key={`${source.material_id}-${source.page_number}`}
                          onClick={() => {
                            setSelectedMaterialId(source.material_id)
                            setSelectedPageNumber(source.page_number)
                          }}
                        >
                          第 {source.page_number} 页 · {source.lecture_title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form className="question-box" onSubmit={handleAsk}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="问问当前课程……"
                rows={3}
                disabled={!selectedCourseId}
              />
              <div className="question-footer">
                <span>本地检索预览</span>
                <button className="send-button" type="submit" disabled={!selectedCourseId || !question.trim()} aria-label="发送问题"><TechIcon name="send" size={15} /></button>
              </div>
            </form>
          </aside>
        </section>
      </main>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <CourseContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        onRename={(courseId, courseName) => {
          setContextMenu(null)
          setCourseAction({ kind: 'rename', courseId, courseName })
        }}
        onDelete={(courseId, courseName) => {
          setContextMenu(null)
          setCourseAction({ kind: 'delete', courseId, courseName })
        }}
      />

      <RenameCourseDialog
        open={courseAction?.kind === 'rename'}
        initialName={courseAction?.courseName ?? ''}
        saving={courseActionSaving}
        onSubmit={(name) => void handleRenameCourse(name)}
        onCancel={() => setCourseAction(undefined)}
      />

      <DeleteCourseDialog
        open={courseAction?.kind === 'delete'}
        courseName={courseAction?.courseName ?? ''}
        saving={courseActionSaving}
        onConfirm={() => void handleDeleteCourse()}
        onCancel={() => setCourseAction(undefined)}
      />
    </div>
  )
}

export default App
