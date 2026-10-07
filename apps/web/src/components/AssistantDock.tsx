import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import type { ChatMessage } from './AppLayout'
import type { Course } from '../types'
import { TeacherCharacter } from './TeacherCharacter'

export function AssistantDock({
  course, courseId, courses, messages, question, setQuestion, askQuestion, assistantBusy,
}: {
  course?: Course
  courseId?: string
  courses: Course[]
  messages: ChatMessage[]
  question: string
  setQuestion: (value: string) => void
  askQuestion: () => Promise<void>
  assistantBusy: boolean
}) {
  const recentMessages = messages.slice(-4)
  const fallbackCourse = courses[0]

  function submitQuestion(event: FormEvent) {
    event.preventDefault()
    if (courseId && question.trim() && !assistantBusy) void askQuestion()
  }

  return (
    <aside className="assistant-dock" aria-label="课程学习助手">
      <header className="assistant-dock-heading">
        <span className="assistant-dock-mark" aria-hidden="true">✦</span>
        <div><strong>课程学习助手</strong><small>{course?.name ?? '选择课程后开始提问'}</small></div>
      </header>
      <div className="assistant-dock-teacher"><TeacherCharacter compact status={assistantBusy ? 'thinking' : 'idle'} /></div>
      {courseId ? (
        <>
          <div className="assistant-dock-intro"><strong>随时问一问</strong><small>优先从课程资料中查找，并标出出处。</small></div>
          <div className="assistant-dock-messages" aria-live="polite">
            {recentMessages.map((message, index) => <article className={`assistant-dock-message assistant-dock-message-${message.role}`} key={`${message.role}-${index}-${message.content.slice(0, 12)}`}><small>{message.role === 'user' ? '你' : '学习助手'}</small><p>{message.content}</p>{message.role === 'assistant' && message.sources?.length ? <span>{message.sources.length} 条资料来源</span> : null}</article>)}
          </div>
          <form className="assistant-dock-form" onSubmit={submitQuestion}>
            <textarea aria-label="快速提问" placeholder="问问当前课程…" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} />
            <div><Link to={`/courses/${courseId}/assistant`}>打开完整答疑</Link><button type="submit" disabled={!question.trim() || assistantBusy}>{assistantBusy ? '思考中…' : '发送问题'}</button></div>
          </form>
        </>
      ) : fallbackCourse ? (
        <div className="assistant-dock-empty"><p>笔记书架展示全部课程内容。进入一门课程后，可以在这里继续提问。</p><Link className="text-button" to={`/courses/${fallbackCourse.id}/assistant`}>打开课程答疑</Link></div>
      ) : <div className="assistant-dock-empty"><p>创建课程并上传学习资料后，可以使用课程答疑。</p><Link className="text-button" to="/">创建课程</Link></div>}
    </aside>
  )
}
