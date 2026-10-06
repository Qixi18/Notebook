import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { useNavigate } from 'react-router-dom'

import { api } from '../api'
import { EmptyState } from '../components/EmptyState'
import { featurePath, useWorkspace } from '../components/AppLayout'
import { SourceCard } from '../components/SourceCard'
import type { NoteRevision, NoteSourceRef } from '../types'

export function NotesPage() {
  const {
    course,
    courseId,
    courseContentLoading,
    notes,
    selectedNote,
    setSelectedNoteId,
    noteDraft,
    setNoteDraft,
    editingNote,
    setEditingNote,
    saveNote,
    noteSaving,
    materials,
    setSelectedMaterialId,
    setSelectedPageNumber,
  } = useWorkspace()
  const navigate = useNavigate()
  const [sources, setSources] = useState<NoteSourceRef[]>([])
  const [revisions, setRevisions] = useState<NoteRevision[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string>()
  const [previewRevision, setPreviewRevision] = useState<NoteRevision>()

  useEffect(() => {
    setPreviewRevision(undefined)
    setSources([])
    setRevisions([])
    setDetailError(undefined)
    if (!selectedNote) return
    let active = true
    setDetailLoading(true)
    void Promise.all([api.getNoteSources(selectedNote.id), api.getNoteRevisions(selectedNote.id)])
      .then(([nextSources, nextRevisions]) => {
        if (!active) return
        setSources(nextSources)
        setRevisions(nextRevisions)
      })
      .catch((cause: unknown) => {
        if (active) setDetailError(cause instanceof Error ? cause.message : '笔记来源读取失败')
      })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedNote?.id, selectedNote?.revision_number])

  function openSource(source: NoteSourceRef) {
    setSelectedMaterialId(source.material_id)
    setSelectedPageNumber(source.page_number)
    if (courseId) navigate(featurePath(courseId, 'materials'))
  }

  const storedContent = previewRevision?.content_markdown ?? selectedNote?.content_markdown ?? ''
  const contentLines = storedContent.split('\n')
  const firstHeading = contentLines[0]?.trim().match(/^#\s+(.+)$/)?.[1]?.trim()
  const displayedContent = firstHeading === selectedNote?.title ? contentLines.slice(1).join('\n').trimStart() : storedContent

  return (
    <div className="feature-page page-enter">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>课程笔记</h1><p>编辑课程整理内容，核对课件来源，并回看已保存的版本。</p></div>
        <span className="page-count-pill">{notes.length} 条笔记</span>
      </header>

      {courseContentLoading ? <div className="page-loading" role="status">正在读取这门课程的笔记…</div> : notes.length === 0 ? (
        <EmptyState icon="▤" title="这门课程还没有笔记" description={materials.length ? '课件解析完成后，系统会从课程页面整理知识点笔记。' : '先上传并解析一份课程资料，再回来查看整理结果。'} />
      ) : (
        <section className="notes-workspace">
          <aside className="notes-index-panel" aria-label="笔记目录">
            <div className="panel-heading"><strong>知识点目录</strong><span>{notes.length}</span></div>
            <div className="notes-index-list">
              {notes.map((note) => (
                <button
                  className={`notes-index-item ${selectedNote?.id === note.id ? 'notes-index-item-active' : ''}`}
                  key={note.id}
                  aria-current={selectedNote?.id === note.id ? 'true' : undefined}
                  onClick={() => setSelectedNoteId(note.id)}
                >
                  <strong>{note.title}</strong>
                  <small>{note.user_locked ? '已保护的用户版本' : 'AI 初稿'} · v{note.revision_number}</small>
                </button>
              ))}
            </div>
          </aside>

          <article className="note-detail-panel">
            {selectedNote ? (
              <>
                <div className="note-detail-heading">
                  <div><span className="eyebrow">{previewRevision ? `历史版本 · v${previewRevision.revision_number}` : selectedNote.content_origin === 'user' ? '用户版本' : '课程整理'}</span><h2>{selectedNote.title}</h2></div>
                  {!editingNote && !previewRevision && <button className="secondary-button" onClick={() => setEditingNote(true)}>编辑笔记</button>}
                  {previewRevision && <button className="secondary-button" onClick={() => setPreviewRevision(undefined)}>返回当前版本</button>}
                </div>
                {editingNote && !previewRevision ? (
                  <>
                    <textarea className="note-editor-textarea" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} aria-label="笔记 Markdown 内容" />
                    <div className="note-editor-footer">
                      <span>保存会生成新版本，并保护你的正文不被后续自动整理覆盖。</span>
                      <div>
                        <button className="text-button" onClick={() => { setNoteDraft(selectedNote.content_markdown); setEditingNote(false) }}>取消</button>
                        <button className="primary-button" onClick={() => void saveNote()} disabled={noteSaving || !noteDraft.trim()}>{noteSaving ? '保存中…' : '保存并保护'}</button>
                      </div>
                    </div>
                  </>
                ) : <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{displayedContent || '此版本没有正文内容。'}</ReactMarkdown></div>}

                <section className="note-evidence-grid" aria-label="笔记来源和修订历史">
                  {detailError && <p className="evidence-error" role="alert">来源或版本历史读取失败：{detailError}</p>}
                  <div className="note-evidence-panel">
                    <div className="panel-heading"><strong>课件来源</strong><span>{sources.length}</span></div>
                    {detailLoading ? <div className="inline-empty" role="status">正在读取来源…</div> : sources.length ? (
                      <div className="source-card-list">{sources.map((source) => (
                        <SourceCard key={source.id} title={materials.find((item) => item.id === source.material_id)?.lecture_title ?? '课程资料'} pageNumber={source.page_number} quote={source.quote} onOpen={() => openSource(source)} />
                      ))}</div>
                    ) : <p className="evidence-empty">{detailError ? '来源暂时无法读取。' : '这条笔记当前没有可追溯的课件片段。'}</p>}
                  </div>

                  <div className="note-evidence-panel">
                    <div className="panel-heading"><strong>修订历史</strong><span>{revisions.length} 个版本</span></div>
                    {detailLoading ? <div className="inline-empty" role="status">正在读取版本…</div> : revisions.length ? (
                      <div className="revision-list">
                        {revisions.slice().reverse().map((revision) => (
                          <button key={revision.id} className={`revision-item ${previewRevision?.id === revision.id ? 'revision-item-active' : ''}`} onClick={() => { setEditingNote(false); setPreviewRevision(revision.revision_number === selectedNote.revision_number ? undefined : revision) }}>
                            <span><strong>v{revision.revision_number}{revision.revision_number === selectedNote.revision_number ? ' · 当前' : ''}</strong><small>{revision.user_locked ? '用户保存' : revision.content_origin === 'ai' ? 'AI 整理' : '课程整理'}</small></span>
                            <time dateTime={revision.created_at}>{new Date(revision.created_at).toLocaleString('zh-CN')}</time>
                          </button>
                        ))}
                      </div>
                    ) : <p className="evidence-empty">暂无可展示的历史版本。</p>}
                  </div>
                </section>
              </>
            ) : <div className="page-loading" role="status">正在读取笔记…</div>}
          </article>
        </section>
      )}
    </div>
  )
}
