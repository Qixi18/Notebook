import { useRef, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { featurePath, useWorkspace } from '../components/AppLayout'

export function AssistantPage() {
  const {
    course,
    courseId,
    materials,
    selectedMaterialId,
    setSelectedMaterialId,
    setSelectedPageNumber,
    messages,
    question,
    setQuestion,
    askQuestion,
  } = useWorkspace()
  const navigate = useNavigate()
  const chatEndRef = useRef<HTMLDivElement>(null)

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
        <span className="assistant-mode-pill"><span className="local-status-dot" />课程范围检索</span>
      </header>

      <section className="assistant-workspace">
        <div className="assistant-context-bar">
          <span className="assistant-avatar-small">✦</span>
          <div><strong>NoteBuddy 教学助手</strong><small>当前课程：{course?.name ?? '未选择课程'}</small></div>
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
              {message.sources?.length ? (
                <div className="answer-sources"><span>回答依据</span>
                  {message.sources.map((source) => (
                    <button key={`${source.material_id}-${source.page_number}`} onClick={() => {
                      setSelectedMaterialId(source.material_id)
                      setSelectedPageNumber(source.page_number)
                      if (courseId) navigate(featurePath(courseId, 'materials'))
                    }}>
                      <strong>{source.lecture_title}</strong><small>第 {source.page_number} 页 · {source.snippet}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          <div ref={chatEndRef} />
        </div>

        {materials.length === 0 && <div className="assistant-no-materials">这门课程还没有资料。上传并解析课件后，答疑才能引用课程内容。</div>}
        <form className="assistant-question-form" onSubmit={handleSubmit}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="问问当前课程……" rows={3} aria-label="课程问题" />
          <div className="assistant-question-footer"><span>问题只会在当前课程范围内检索</span><button className="primary-button" type="submit" disabled={!question.trim()}>发送问题 <span aria-hidden="true">↑</span></button></div>
        </form>
      </section>
    </div>
  )
}
