import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

import { useWorkspace } from '../components/AppLayout'

export function NotesPage() {
  const {
    course,
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
  } = useWorkspace()

  return (
    <div className="feature-page page-enter">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>课程笔记</h1><p>按知识点整理的课程内容，可继续编辑并保留用户版本。</p></div>
        <span className="page-count-pill">{notes.length} 条笔记</span>
      </header>

      {notes.length === 0 ? (
        <section className="feature-empty-card">
          <span className="empty-state-mark">▤</span>
          <h2>这门课程还没有笔记</h2>
          <p>{materials.length ? '课件解析完成后，系统会从课程页面整理知识点笔记。' : '先上传并解析一份课程资料，再回来查看整理结果。'}</p>
        </section>
      ) : (
        <section className="notes-workspace">
          <aside className="notes-index-panel" aria-label="笔记目录">
            <div className="panel-heading"><strong>知识点目录</strong><span>{notes.length}</span></div>
            <div className="notes-index-list">
              {notes.map((note) => (
                <button
                  className={`notes-index-item ${selectedNote?.id === note.id ? 'notes-index-item-active' : ''}`}
                  key={note.id}
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
                  <div><span className="eyebrow">{selectedNote.content_origin === 'user' ? '用户版本' : '课程整理'}</span><h2>{selectedNote.title}</h2></div>
                  {!editingNote && <button className="secondary-button" onClick={() => setEditingNote(true)}>编辑笔记</button>}
                </div>
                {editingNote ? (
                  <>
                    <textarea
                      className="note-editor-textarea"
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      aria-label="笔记 Markdown 内容"
                    />
                    <div className="note-editor-footer">
                      <span>保存会生成新版本，并保护你的正文不被后续自动整理覆盖。</span>
                      <div>
                        <button className="text-button" onClick={() => { setNoteDraft(selectedNote.content_markdown); setEditingNote(false) }}>取消</button>
                        <button className="primary-button" onClick={() => void saveNote()} disabled={noteSaving || !noteDraft.trim()}>
                          {noteSaving ? '保存中…' : '保存并保护'}
                        </button>
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
                <aside className="note-source-placeholder">
                  <span className="source-placeholder-icon">↗</span>
                  <span><strong>来源与修订记录</strong><small>阶段一保留现有笔记内容与版本号；来源和历史详情接口在后续阶段接入。</small></span>
                </aside>
              </>
            ) : <div className="page-loading">正在读取笔记…</div>}
          </article>
        </section>
      )}
    </div>
  )
}
