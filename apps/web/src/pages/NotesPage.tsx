import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { Link, useNavigate } from 'react-router-dom'

import { api } from '../api'
import { EmptyState } from '../components/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { featurePath, useWorkspace } from '../components/AppLayout'
import { SourceCard } from '../components/SourceCard'
import type { NoteRevision, NoteSourceRef } from '../types'

export function NotesPage() {
  const {
    course,
    courseId,
    courseContentLoading,
    graph,
    notes,
    selectedNote,
    setSelectedNoteId,
    noteDraft,
    setNoteDraft,
    editingNote,
    setEditingNote,
    saveNote,
    noteSaving,
    noteDirty,
    reloadNote,
    error,
    setError,
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
  const [lectureFilter, setLectureFilter] = useState('all')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [pendingNoteAction, setPendingNoteAction] = useState<{ kind: 'select'; noteId: string } | { kind: 'revision'; revision: NoteRevision }>()
  const [webSources, setWebSources] = useState<import('../types').WebSource[]>([])
  const [suggestions, setSuggestions] = useState<Array<{ id: string; proposed_markdown: string; impact: string; status: string }>>([])
  const filteredNotes = notes.filter((note) => lectureFilter === 'all' || graph.nodes.find((node) => node.id === note.knowledge_node_id)?.sources.some((source) => source.material_id === lectureFilter))

  useEffect(() => {
    setPreviewRevision(undefined)
    setSources([])
    setRevisions([])
    setWebSources([])
    setDetailError(undefined)
    if (!selectedNote) return
    let active = true
    setDetailLoading(true)
    void Promise.all([api.getNoteSources(selectedNote.id), api.getNoteRevisions(selectedNote.id), api.getNoteWebSources(selectedNote.id), api.listSuggestions(selectedNote.id)])
      .then(([nextSources, nextRevisions, nextWebSources, nextSuggestions]) => {
        if (!active) return
        setSources(nextSources)
        setRevisions(nextRevisions)
        setWebSources(nextWebSources)
        setSuggestions(nextSuggestions)
      })
      .catch((cause: unknown) => {
        if (active) setDetailError(cause instanceof Error ? cause.message : '笔记来源读取失败')
      })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedNote?.id, selectedNote?.revision_number])

  async function reviewSuggestion(suggestionId: string, decision: 'confirm' | 'reject') {
    if (!selectedNote) return
    const updated = await api.reviewSuggestion(selectedNote.id, suggestionId, decision)
    setSuggestions((items) => items.map((item) => item.id === suggestionId ? { ...item, status: decision === 'confirm' ? 'accepted' : 'rejected' } : item))
    if (decision === 'confirm') {
      setSelectedNoteId(updated.id)
      await reloadNote()
    }
  }

  function openSource(source: NoteSourceRef) {
    setSelectedMaterialId(source.material_id)
    setSelectedPageNumber(source.page_number)
    if (courseId) navigate(featurePath(courseId, 'materials'))
  }

  function requestNoteSelection(noteId: string) {
    if (noteDirty) { setPendingNoteAction({ kind: 'select', noteId }); return }
    setSelectedNoteId(noteId)
  }

  function requestRevisionPreview(revision: NoteRevision) {
    if (noteDirty) { setPendingNoteAction({ kind: 'revision', revision }); return }
    setEditingNote(false)
    setPreviewRevision(revision.revision_number === selectedNote?.revision_number ? undefined : revision)
  }

  function confirmPendingNoteAction() {
    if (!pendingNoteAction) return
    if (pendingNoteAction.kind === 'select') {
      setSelectedNoteId(pendingNoteAction.noteId)
    } else {
      setEditingNote(false)
      setPreviewRevision(pendingNoteAction.revision.revision_number === selectedNote?.revision_number ? undefined : pendingNoteAction.revision)
    }
    setPendingNoteAction(undefined)
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
        <EmptyState icon="▤" title="这门课程还没有笔记" description={materials.length ? '课件解析完成后，系统会从课程页面整理知识点笔记。' : '先上传并解析一份课程资料，再回来查看整理结果。'} action={courseId ? <Link className="secondary-button link-button" to={featurePath(courseId, 'materials')}>前往课程资料</Link> : undefined} />
      ) : (
        <section className="notes-workspace">
          <aside className="notes-index-panel" aria-label="笔记目录">
            <div className="panel-heading"><strong>知识点目录</strong><span>{filteredNotes.length}/{notes.length}</span></div>
            <label className="notes-lecture-filter">讲次筛选<select value={lectureFilter} onChange={(event) => setLectureFilter(event.target.value)}><option value="all">全部讲次</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.lecture_title}</option>)}</select></label>
            <div className="notes-index-list">
              {filteredNotes.map((note) => (
                <button
                  className={`notes-index-item ${selectedNote?.id === note.id ? 'notes-index-item-active' : ''}`}
                  key={note.id}
                  aria-current={selectedNote?.id === note.id ? 'true' : undefined}
                  onClick={() => requestNoteSelection(note.id)}
                >
                  <strong>{note.title}</strong>
                  <small>{note.user_locked ? '已保护的用户版本' : note.content_origin === 'ai_web_augmented' ? '含网络补充来源' : 'AI 初稿'} · v{note.revision_number}</small>
                </button>
              ))}
            </div>
          </aside>

          <div className="note-detail-panel">
            {selectedNote ? (
              <>
                <div className="note-detail-heading">
                  <div><span className="eyebrow">{previewRevision ? `历史版本 · v${previewRevision.revision_number}` : selectedNote.content_origin === 'user' ? '用户版本' : selectedNote.content_origin === 'ai_web_augmented' ? '课程整理 · 含独立标注的网络来源' : '课程整理'}</span><h2>{selectedNote.title}</h2></div>
                  {!editingNote && !previewRevision && <button className="secondary-button" onClick={() => setEditingNote(true)}>编辑笔记</button>}
                  {previewRevision && <button className="secondary-button" onClick={() => setPreviewRevision(undefined)}>返回当前版本</button>}
                </div>
                {editingNote && !previewRevision ? (
                  <>
                    <textarea className="note-editor-textarea" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} aria-label="笔记 Markdown 内容" />
                    <div className="note-editor-footer">
                      <span role="status">{noteSaving ? '正在保存…' : noteDirty ? '有尚未保存的修改' : '内容已保存'}。保存会生成新版本并保护正文。</span>
                      <div>
                        <button className="text-button" onClick={() => { setNoteDraft(selectedNote.content_markdown); setEditingNote(false) }}>取消</button>
                        <button className="primary-button" onClick={() => void saveNote()} disabled={noteSaving || !noteDraft.trim()}>{noteSaving ? '保存中…' : '保存并保护'}</button>
                      </div>
                    </div>
                  </>
                ) : <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{displayedContent || '此版本没有正文内容。'}</ReactMarkdown></div>}

                {error?.includes('笔记已在其他操作中更新') && <div className="note-conflict-panel" role="alert"><strong>检测到版本冲突</strong><p>可以载入最新版本重新编辑，或保留当前草稿并自行比较。载入最新版本会替换当前编辑内容。</p><button className="secondary-button" onClick={() => void reloadNote().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : '最新版本读取失败'))}>载入最新版本</button><button className="text-button" onClick={() => setError(undefined)}>保留当前草稿</button></div>}

              </>
            ) : <div className="page-loading" role="status">正在读取笔记…</div>}
          </div>
          {selectedNote && <button className="note-evidence-toggle" aria-expanded={evidenceOpen} onClick={() => setEvidenceOpen((open) => !open)}>{evidenceOpen ? '收起来源与历史' : `查看来源与历史 · ${sources.length} 条来源 / ${revisions.length} 个版本`}</button>}
                {selectedNote && <aside className={`note-evidence-sidebar ${evidenceOpen ? 'note-evidence-sidebar-open' : ''}`} aria-label="笔记来源与修订历史">
            {detailError && <p className="evidence-error" role="alert">来源或版本历史读取失败：{detailError}</p>}
            <div className="note-evidence-panel"><div className="panel-heading"><strong>课件来源</strong><span>{sources.length}</span></div>{detailLoading ? <div className="inline-empty" role="status">正在读取来源…</div> : sources.length ? <div className="source-card-list">{sources.map((source) => <SourceCard key={source.id} title={materials.find((item) => item.id === source.material_id)?.lecture_title ?? '课程资料'} pageNumber={source.page_number} locationLabel={source.location_label} quote={source.quote} sourceLabel={source.status === 'active' ? '课程课件' : '待核对来源'} onOpen={() => openSource(source)} />)}</div> : <p className="evidence-empty">{detailError ? '来源暂时无法读取。' : '这条笔记当前没有可追溯的课件片段。'}</p>}</div>
            <div className="note-evidence-panel"><div className="panel-heading"><strong>网络补充来源</strong><span>{webSources.length}</span></div>{webSources.length ? <div className="source-card-list">{webSources.map((source) => <a className="source-card" key={source.id} href={source.url} target="_blank" rel="noreferrer"><span className="source-card-icon">↗</span><span className="source-card-body"><small className="source-card-meta">{source.site_name} · 检索于 {new Date(source.retrieved_at).toLocaleDateString('zh-CN')}</small><strong>{source.title}</strong><small>{source.snippet}</small></span></a>)}</div> : <p className="evidence-empty">尚无关联网络来源；检索关闭或没有达到链接格式与相关度要求的结果时，这里会保持为空。</p>}</div>
            <div className="note-evidence-panel"><div className="panel-heading"><strong>修订历史</strong><span>{revisions.length} 个版本</span></div>{detailLoading ? <div className="inline-empty" role="status">正在读取版本…</div> : revisions.length ? <div className="revision-list">{revisions.slice().reverse().map((revision) => <button key={revision.id} className={`revision-item ${previewRevision?.id === revision.id ? 'revision-item-active' : ''}`} onClick={() => requestRevisionPreview(revision)}><span><strong>v{revision.revision_number}{revision.revision_number === selectedNote.revision_number ? ' · 当前' : ''}</strong><small>{revision.user_locked ? '用户保存' : revision.content_origin === 'ai_web_augmented' ? '含网络补充来源' : revision.content_origin === 'ai' ? 'AI 整理' : '课程整理'}</small></span><time dateTime={revision.created_at}>{new Date(revision.created_at).toLocaleString('zh-CN')}</time></button>)}</div> : <p className="evidence-empty">暂无可展示的历史版本。</p>}</div>
            <div className="note-evidence-panel"><div className="panel-heading"><strong>AI 建议片段</strong><span>{suggestions.filter((item) => item.status === 'pending').length} 待确认</span></div>{suggestions.filter((item) => item.status === 'pending').length ? suggestions.filter((item) => item.status === 'pending').map((suggestion) => <article className="proposal-card" key={suggestion.id}><small>{suggestion.impact}</small><p>{suggestion.proposed_markdown.slice(0, 240)}</p><div><button className="secondary-button" onClick={() => void reviewSuggestion(suggestion.id, 'confirm')}>接受并生成版本</button><button className="text-button" onClick={() => void reviewSuggestion(suggestion.id, 'reject')}>拒绝</button></div></article>) : <p className="evidence-empty">没有待确认的 AI 笔记建议；用户正文不会被自动改写。</p>}</div>
          </aside>}
        </section>
      )}
      {pendingNoteAction && <ConfirmDialog
        eyebrow="未保存的笔记"
        title={pendingNoteAction.kind === 'select' ? '切换笔记并放弃草稿？' : '预览历史版本并放弃草稿？'}
        description={pendingNoteAction.kind === 'select' ? '当前修改尚未保存。切换到另一条笔记会丢弃这份草稿，已保存的笔记正文不会改变。' : '当前修改尚未保存。切换到历史版本会丢弃这份草稿，已保存的笔记正文不会改变。'}
        confirmLabel={pendingNoteAction.kind === 'select' ? '放弃草稿并切换' : '放弃草稿并预览'}
        cancelLabel="继续编辑"
        tone="danger"
        onConfirm={confirmPendingNoteAction}
        onCancel={() => setPendingNoteAction(undefined)}
      />}
    </div>
  )
}
