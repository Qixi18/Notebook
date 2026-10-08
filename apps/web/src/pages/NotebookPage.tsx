import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useWorkspace } from '../components/AppLayout'
import { adjacentSection, notebookPath, resolveSection } from '../features/notebook/navigation'
import type { Notebook, NotebookSection } from '../types'
import { NoteSectionReader } from './NotesPage'

export function NotebookPage() {
  const { courseId = '' } = useParams()
  const [query] = useSearchParams()
  const navigate = useNavigate()
  const { notes, upsertNotes, setSelectedNoteId, courseContentLoading, noteDirty } = useWorkspace()
  const [outline, setOutline] = useState<Notebook>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [reading, setReading] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const mode = query.get('mode') === 'book' ? 'book' : 'chapter'
  const chapterParam = query.get('chapter') ?? undefined
  const sectionParam = query.get('section') ?? undefined
  const selected = outline && resolveSection(outline, chapterParam, sectionParam)
  const chapter = outline && [...outline.chapters, ...outline.removed_chapters].find((c) => c.id === (selected?.material_id ?? chapterParam))
  const directSectionId = (!selected?.material_id || chapter?.deleted_at) ? selected?.id : undefined

  useEffect(() => {
    let active = true
    setOutline(undefined); setLoading(true); setError(undefined)
    void api.getNotebook(courseId).then((book) => { if (active) setOutline(book) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : '目录读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courseId])

  useEffect(() => {
    if (!outline || courseContentLoading) return
    let active = true
    setReading(true); setError(undefined)
    async function load() {
      const chapters = mode === 'book' ? outline!.chapters : chapter && !chapter.deleted_at ? [chapter] : []
      for (const item of chapters) {
        const content = await api.getChapter(courseId, item.id)
        if (!active) return
        upsertNotes(content.sections)
      }
      if (selected && (!selected.material_id || chapter?.deleted_at)) {
        const note = await api.getNote(selected.id)
        if (active && note.course_id === courseId) upsertNotes([note])
      }
    }
    void load().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : '章节读取失败') })
      .finally(() => { if (active) setReading(false) })
    return () => { active = false }
  }, [courseId, outline, chapter?.id, mode, directSectionId, courseContentLoading, upsertNotes])

  useEffect(() => {
    if (!selected || courseContentLoading || !notes.some((n) => n.id === selected.id)) return
    setSelectedNoteId(selected.id)
    if (!reading && sectionParam) document.getElementById(`section-${selected.id}`)?.scrollIntoView({ block: 'start' })
  }, [selected?.id, sectionParam, reading, courseContentLoading, notes, setSelectedNoteId])

  function open(section: NotebookSection) { navigate(notebookPath(courseId, section, mode)) }
  async function moveChapter(index: number, direction: number) {
    if (!outline || ordering || noteDirty) return
    const ids = outline.chapters.map((c) => c.id)
    ;[ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]
    setOrdering(true)
    try { setOutline(await api.reorderChapters(courseId, ids, outline.order_revision)) }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : '排序失败')
      try { setOutline(await api.getNotebook(courseId)) } catch { /* Keep last readable outline. */ }
    } finally { setOrdering(false) }
  }

  if (loading) return <p role="status">正在读取课程目录…</p>
  if (!outline) return <p role="alert">{error ?? '笔记本读取失败'}</p>
  const previous = selected && adjacentSection(outline, selected.id, -1)
  const next = selected && adjacentSection(outline, selected.id, 1)
  const visibleChapters = mode === 'book' ? [...outline.chapters, ...(chapter?.deleted_at ? [chapter] : [])] : chapter ? [chapter] : []
  return <div className="notebook-page page-enter">
    <header className="notebook-header"><div><Link to="/notes">← 课程书架</Link><h1>{outline.title}</h1><p>{outline.chapters.length} 章 · 按讲次阅读与积累</p></div><div className="notebook-modes" role="group" aria-label="阅读模式"><button className={mode === 'chapter' ? 'primary-button' : 'secondary-button'} onClick={() => navigate(notebookPath(courseId, selected))}>章节阅读</button><button className={mode === 'book' ? 'primary-button' : 'secondary-button'} onClick={() => navigate(notebookPath(courseId, selected, 'book'))}>整本阅读</button></div></header>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="notebook-layout"><nav className="notebook-outline" aria-label="笔记本目录"><h2>目录</h2>
      {outline.chapters.map((item, index) => <div className="notebook-chapter-entry" key={item.id}>
        <div className="notebook-chapter-title"><button onClick={() => navigate(`/courses/${courseId}/notebook?chapter=${item.id}${mode === 'book' ? '&mode=book' : ''}`)}>{index + 1}. {item.title}</button><span><button aria-label={`上移${item.title}`} disabled={index === 0 || ordering || noteDirty} onClick={() => void moveChapter(index, -1)}>↑</button><button aria-label={`下移${item.title}`} disabled={index === outline.chapters.length - 1 || ordering || noteDirty} onClick={() => void moveChapter(index, 1)}>↓</button></span></div>
        {item.sections.map((s) => <button className={`notebook-section-link ${selected?.id === s.id ? 'active' : ''}`} key={s.id} aria-current={selected?.id === s.id ? 'location' : undefined} onClick={() => open(s)}>{s.title}{s.user_locked ? ' · 已编辑' : ''}</button>)}
        {!item.sections.length && <small>{item.status === 'failed' ? '解析失败，请在资料页重试' : item.status === 'completed' ? '暂无可生成的小节，请检查来源' : '资料处理中'}</small>}
      </div>)}
      {outline.historical_sections.length > 0 && <details open={selected?.material_id === null}><summary>历史整理</summary><small>原有来源无法归入单讲，保留完整正文。</small>{outline.historical_sections.map((s) => <button className="notebook-section-link" key={s.id} onClick={() => open(s)}>{s.title}</button>)}</details>}
      {outline.removed_chapters.length > 0 && <details><summary>已移除资料的章节</summary>{outline.removed_chapters.map((c) => <div key={c.id}><strong>{c.title}</strong>{c.sections.map((s) => <button className="notebook-section-link" key={s.id} onClick={() => open(s)}>{s.title}</button>)}</div>)}</details>}
      <Link className="secondary-button link-button" to={`/courses/${courseId}/materials`}>上传下一讲</Link>
    </nav><main className="notebook-content" aria-label="笔记本正文">
      {reading && <p role="status">正在按章节读取正文…</p>}
      {sectionParam && !selected ? <p role="alert">没有找到指定的小节；请从目录重新选择。</p> : chapterParam && !chapter && chapterParam !== 'history' ? <p role="alert">没有找到指定章节。</p> : <>
        {visibleChapters.map((item) => <section className="notebook-chapter-document" key={item.id}><h2>{item.title}{item.deleted_at ? ' · 资料已移除' : ''}</h2>{item.sections.map((s) => {
          const note = notes.find((n) => n.id === s.id)
          return <article id={`section-${s.id}`} className="notebook-section" key={s.id}>
            {selected?.id === s.id && note ? <NoteSectionReader noteId={s.id} /> : <><header><h3>{s.title}</h3><button className="text-button" onClick={() => open(s)}>定位与编辑此小节</button></header>{note ? <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{note.content_markdown}</ReactMarkdown></div> : <p role="status">{reading ? '正在读取…' : '正文暂未载入，请重试。'}</p>}</>}
          </article>
        })}{!item.sections.length && <p>本章暂时没有小节。<Link to={`/courses/${courseId}/materials`}>检查资料与处理状态</Link></p>}</section>)}
        {selected?.material_id === null && <section id={`section-${selected.id}`}><h2>历史整理</h2>{notes.some((n) => n.id === selected.id) && <NoteSectionReader noteId={selected.id} />}</section>}
        {!outline.chapters.length && !outline.historical_sections.length && <p>笔记本已准备好。<Link to={`/courses/${courseId}/materials`}>上传第一讲资料</Link>，生成第一个章节。</p>}
        {selected && <div className="notebook-pagination"><button className="secondary-button" disabled={!previous} onClick={() => previous && open(previous)}>← 上一小节</button><button className="secondary-button" disabled={!next} onClick={() => next && open(next)}>下一小节 →</button></div>}
      </>}
    </main></div>
  </div>
}
