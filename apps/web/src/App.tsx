import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import { api } from './api'
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

  return (
    <div className="app-shell">
      <aside className="icon-rail" aria-label="主导航">
        <div className="brand-mark">N</div>
        <button className="rail-button rail-button-active" title="笔记">▤</button>
        <button className="rail-button" title="知识树">⌘</button>
        <button className="rail-button" title="资料">▱</button>
        <button className="rail-button" title="设置">⚙</button>
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
            placeholder="新建课程，例如：国际经济学"
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
            >
              <span className="course-icon">◈</span>
              <span>
                <strong>{course.name}</strong>
                <small>{course.id === selectedCourseId ? '当前课程' : '打开课程'}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" /> 本地 Demo · 数据保存在本机
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">课程工作区</span>
            <h2>{selectedCourse?.name ?? '开始建立你的第一门课程'}</h2>
            <p>{courseSubtitle}</p>
          </div>
          <div className="header-actions">
            <span className="prototype-pill">初版原型</span>
            <button className="ghost-button" onClick={() => void refreshCourses()}>↻ 刷新</button>
          </div>
        </header>

        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(undefined)}>关闭</button>
          </div>
        )}

        <section className="content-grid">
          <div className="note-column">
            <div className="tab-row">
              <button
                className={`tab ${activeView === 'notes' ? 'tab-active' : ''}`}
                onClick={() => setActiveView('notes')}
              >
                笔记
              </button>
              <button
                className={`tab ${activeView === 'graph' ? 'tab-active' : ''}`}
                onClick={() => setActiveView('graph')}
              >
                思维导图
              </button>
              <button className="tab">覆盖总览 <span>下一阶段</span></button>
            </div>

            <div className="note-card">
              <div className="note-toolbar">
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

              <div className="material-section">
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
                    <span className="material-icon">P</span>
                    <span className="material-info">
                      <strong>{material.lecture_title}</strong>
                      <small>{material.original_filename} · {material.page_count} 页</small>
                    </span>
                    <span className={`status-chip status-${material.status}`}>{statusLabels[material.status] ?? material.status}</span>
                  </button>
                ))}
              </div>

              <div className="page-section">
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
                <article className="page-detail">
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
            </div>
          </div>

          <aside className="assistant-column">
            <div className="assistant-header">
              <div className="avatar">✦</div>
              <div>
                <span className="eyebrow">课程答疑伙伴</span>
                <h3>Ask NoteBuddy</h3>
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
                <button className="send-button" type="submit" disabled={!selectedCourseId || !question.trim()}>↑</button>
              </div>
            </form>
          </aside>
        </section>
      </main>
    </div>
  )
}

export default App
