import { useRef, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { featurePath, useWorkspace } from '../components/AppLayout'
import { SourceCard } from '../components/SourceCard'
import { TeacherCharacter } from '../components/TeacherCharacter'

export function AssistantPage() {
  const {
    course,
    courseId,
    materials,
    courseContentLoading,
    selectedMaterialId,
    setSelectedMaterialId,
    setSelectedPageNumber,
    messages,
    assistantBusy,
    question,
    setQuestion,
    askQuestion,
  } = useWorkspace()
  const navigate = useNavigate()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
  const teacherStatus = assistantBusy ? 'thinking' : lastAssistantMessage?.status ?? 'idle'

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void askQuestion()
  }

  return (
    <div className="feature-page page-enter assistant-page">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>AI 课程答疑</h1><p>回答优先依据当前课程已解析页面，并展示检索到的课件来源。</p></div>
        <span className="assistant-mode-pill"><span className="local-status-dot" />仅检索本课程资料 · 联网搜索未启用</span>
      </header>

      <section className="assistant-workspace">
        <div className="assistant-context-bar">
          <TeacherCharacter status={teacherStatus} compact />
          <div><strong>NoteBuddy 教学助手</strong><small>当前课程：{course?.name ?? '未选择课程'}</small><span className="assistant-teacher-status" aria-live="polite" aria-atomic="true">{assistantBusy ? '正在检索本课程内容并组织回答…' : teacherStatus === 'error' ? '刚才的回答未能完成，可稍后重试' : teacherStatus === 'explaining' ? '已根据课程内容生成回答' : '等待你的课程问题'}</span></div>
          <label className="assistant-material-scope">限定资料
            <select value={selectedMaterialId ?? ''} onChange={(event) => setSelectedMaterialId(event.target.value || undefined)}>
              <option value="">整门课程</option>
              {materials.map((material) => <option key={material.id} value={material.id}>{material.lecture_title}</option>)}
            </select>
          </label>
        </div>

        <div className="assistant-conversation" aria-live="polite">
          {messages.map((message, index) => (
            <article className={`conversation-message conversation-${message.role}`} key={`${message.role}-${index}`}>
              <span className="conversation-author">{message.role === 'assistant' ? 'NoteBuddy' : '你'}</span>
              <p>{message.content}</p>
              {message.status === 'explaining' && <span className="answer-mode-label">{message.mode === 'deepseek-rag' ? 'AI 生成 · 参考当前课程来源' : message.mode === 'local-retrieval-fallback' ? '本地检索结果 · 模型回答暂不可用' : '当前课程资料检索'}</span>}
              {message.role === 'assistant' && message.status === 'explaining' && (!message.sources || message.sources.length === 0) && <span className="answer-no-evidence">这次回答没有找到可直接引用的课程页面。联网搜索尚未启用。</span>}
              {message.sources?.length ? (
                <div className="answer-sources"><span>回答依据 · 课程课件</span>
                  {message.sources.map((source) => (
                    <SourceCard key={`${source.material_id}-${source.page_number}`} title={source.lecture_title} pageNumber={source.page_number} quote={source.snippet} onOpen={() => {
                      setSelectedMaterialId(source.material_id)
                      setSelectedPageNumber(source.page_number)
                      if (courseId) navigate(featurePath(courseId, 'materials'))
                    }} />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          <div ref={chatEndRef} />
        </div>

        {courseContentLoading ? <div className="assistant-no-materials" role="status">正在读取课程资料…</div> : materials.length === 0 && <div className="assistant-no-materials">这门课程还没有资料。上传并解析课件后，答疑才能引用课程内容。</div>}
        <form className="assistant-question-form" onSubmit={handleSubmit}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="问问当前课程……" rows={3} aria-label="课程问题" />
          <div className="assistant-question-footer"><span>问题只会在当前课程范围内检索</span><button className="primary-button" type="submit" disabled={!question.trim() || assistantBusy}>{assistantBusy ? '正在思考…' : '发送问题'} <span aria-hidden="true">↑</span></button></div>
        </form>
      </section>
    </div>
  )
}
