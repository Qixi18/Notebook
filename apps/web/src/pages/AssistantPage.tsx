import { useRef, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { featurePath, useWorkspace } from '../components/AppLayout'
import { SourceCard } from '../components/SourceCard'
import { TeacherCharacter } from '../components/TeacherCharacter'
import { api } from '../api'
import type { Conversation, ConversationMessage } from '../types'

export function AssistantPage() {
  const {
    course,
    courseId,
    materials,
    courseContentLoading,
    selectedMaterialId,
    setSelectedMaterialId,
    pages,
    setSelectedPageNumber,
    messages,
    assistantBusy,
    question,
    setQuestion,
    askQuestion,
  } = useWorkspace()
  const navigate = useNavigate()
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [webStatus, setWebStatus] = useState<{ configured: boolean; status: string }>({ configured: false, status: 'unconfigured' })
  const [assistantMaterialId, setAssistantMaterialId] = useState<string>()
  const [assistantPageNumber, setAssistantPageNumber] = useState<number>()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string>()
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([])
  const [conversationBusy, setConversationBusy] = useState(false)
  const [learningGoal, setLearningGoal] = useState('理解概念')
  const [feedbackSaved, setFeedbackSaved] = useState<string>()
  const [term, setTerm] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [termExplanation, setTermExplanation] = useState<Awaited<ReturnType<typeof api.explainTerm>>>()
  const [termBusy, setTermBusy] = useState(false)
  const [termError, setTermError] = useState<string>()
  useEffect(() => { setAssistantMaterialId(undefined); setAssistantPageNumber(undefined) }, [courseId])
  useEffect(() => { void api.getWebSearchStatus().then(setWebStatus).catch(() => setWebStatus({ configured: false, status: 'unavailable' })) }, [])
  useEffect(() => {
    let active = true
    if (!courseId) return () => { active = false }
    void api.listConversations(courseId).then(async (items) => {
      let next = items
      if (next.length === 0) next = [await api.createConversation(courseId)]
      if (!active) return
      setConversations(next)
      setConversationId(next[0].id)
      const history = await api.listConversationMessages(next[0].id)
      if (active) setConversationMessages(history)
    }).catch(() => { if (active) setConversationMessages([]) })
    return () => { active = false }
  }, [courseId])
  async function selectConversation(id: string) {
    setConversationId(id)
    setConversationMessages(await api.listConversationMessages(id))
  }
  async function sendPersistentQuestion() {
    if (!courseId || !conversationId || !question.trim()) return
    const text = question.trim()
    setQuestion('')
    setConversationBusy(true)
    try {
      const answer = await api.sendConversationMessage(conversationId, { question: text, material_id: assistantMaterialId, page_number: assistantPageNumber, learning_goal: learningGoal, allow_web: true, idempotency_key: `${conversationId}-${Date.now()}` })
      setConversationMessages((current) => [...current, { id: `local-${Date.now()}`, conversation_id: conversationId, role: 'user', content: text, learning_goal: learningGoal, status: 'completed', model_version: null, failure_type: null, created_at: new Date().toISOString(), evidence: [] }, answer])
    } catch { setQuestion(text) } finally { setConversationBusy(false) }
  }
  async function explainTerm(event: FormEvent) {
    event.preventDefault()
    if (!courseId || !term.trim() || termBusy) return
    try {
      setTermBusy(true)
      setTermError(undefined)
      setTermExplanation(await api.explainTerm(courseId, term.trim(), discipline.trim() || undefined))
    } catch (cause) {
      setTermError(cause instanceof Error ? cause.message : '术语解释失败')
      setTermExplanation(undefined)
    } finally {
      setTermBusy(false)
    }
  }
  const displayMessages = conversationMessages.length ? conversationMessages.map((message) => ({
    role: message.role, content: message.content, status: message.status === 'completed' ? (message.role === 'assistant' ? 'explaining' : 'idle') : 'error',
    persistedId: message.id, evidence: message.evidence, sources: undefined, mode: undefined, webSearchStatus: undefined,
  })) : messages.map((message) => ({ ...message, persistedId: undefined, evidence: [], sources: message.sources, mode: message.mode, webSearchStatus: message.webSearchStatus }))
  const lastAssistantMessage = [...displayMessages].reverse().find((message) => message.role === 'assistant')
  const teacherStatus = assistantBusy || conversationBusy ? 'thinking' : (lastAssistantMessage?.status as 'idle' | 'thinking' | 'explaining' | 'error' | undefined) ?? 'idle'

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [displayMessages.length])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (conversationId) void sendPersistentQuestion()
    else void askQuestion(assistantMaterialId, assistantPageNumber)
  }

  return (
    <div className="feature-page page-enter assistant-page">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>AI 课程答疑</h1><p>回答优先依据当前课程已解析页面，并展示检索到的课件来源。</p></div>
        <span className="assistant-mode-pill"><span className="local-status-dot" />课程资料优先 · {webStatus.status === 'connected' ? 'Tavily 已验证连接' : webStatus.configured ? 'Tavily 已配置，连接待验证' : '联网搜索未配置'}</span>
      </header>

      <section className="assistant-workspace">
        <div className="assistant-context-bar">
          <TeacherCharacter status={teacherStatus} compact />
          <div><strong>NoteBuddy 教学助手</strong><small>当前课程：{course?.name ?? '未选择课程'}</small><span className="assistant-teacher-status" aria-live="polite" aria-atomic="true">{assistantBusy ? '正在检索本课程内容并组织回答…' : teacherStatus === 'error' ? '刚才的回答未能完成，可稍后重试' : teacherStatus === 'explaining' ? '已根据课程内容生成回答' : '等待你的课程问题'}</span></div>
          <label className="assistant-material-scope">限定资料
            <select value={assistantMaterialId ?? ''} onChange={(event) => { const id = event.target.value || undefined; setAssistantMaterialId(id); if (id) setSelectedMaterialId(id); setAssistantPageNumber(undefined) }}>
              <option value="">整门课程</option>
              {materials.map((material) => <option key={material.id} value={material.id}>{material.lecture_title}</option>)}
            </select>
          </label>
          <label className="assistant-material-scope">会话
            <select value={conversationId ?? ''} onChange={(event) => void selectConversation(event.target.value)} aria-label="选择答疑会话">
              {conversations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="assistant-material-scope">学习目标
            <select value={learningGoal} onChange={(event) => setLearningGoal(event.target.value)}><option>理解概念</option><option>准备复习</option><option>解决练习</option><option>比较方法</option></select>
          </label>
          {assistantMaterialId && <label className="assistant-material-scope">限定页面<select value={assistantPageNumber ?? ''} onChange={(event) => setAssistantPageNumber(event.target.value ? Number(event.target.value) : undefined)}><option value="">整份资料</option>{assistantMaterialId === selectedMaterialId && pages.map((page) => <option value={page.page_number} key={page.id}>第 {page.page_number} 页 · {page.title ?? '未识别标题'}</option>)}</select></label>}
        </div>

        <details className="assistant-term-panel">
          <summary>术语原文说明</summary>
          <p>输入课程中的术语，查看原文、常见译法和学科语境。没有可核验出处时会明确标记不确定。</p>
          <form onSubmit={(event) => void explainTerm(event)}>
            <input value={term} onChange={(event) => setTerm(event.target.value)} maxLength={200} placeholder="例如：dependency injection" aria-label="术语" />
            <input value={discipline} onChange={(event) => setDiscipline(event.target.value)} maxLength={100} placeholder="学科（可选）" aria-label="学科" />
            <button className="secondary-button" type="submit" disabled={!term.trim() || termBusy}>{termBusy ? '查询中…' : '解释术语'}</button>
          </form>
          {termError && <p className="form-error" role="alert">{termError}</p>}
          {termExplanation && <div className={`term-explanation ${termExplanation.uncertain ? 'term-explanation-uncertain' : ''}`} role="status"><strong>{termExplanation.original}{termExplanation.discipline ? ` · ${termExplanation.discipline}` : ''}</strong>{termExplanation.common_translations.length > 0 && <span>常见译法：{termExplanation.common_translations.join('、')}</span>}<p>{termExplanation.explanation}</p><small>{termExplanation.source_note}{termExplanation.uncertain ? ' · 不确定' : ''}</small></div>}
        </details>

        <div className="assistant-conversation" aria-live="polite">
          {displayMessages.map((message, index) => (
            <article className={`conversation-message conversation-${message.role}`} key={`${message.role}-${index}`}>
              <span className="conversation-author">{message.role === 'assistant' ? 'NoteBuddy' : '你'}</span>
              <p>{message.content}</p>
              {message.status === 'explaining' && <span className="answer-mode-label">{message.mode === 'deepseek-rag' ? 'AI 生成 · 参考当前课程来源' : message.mode === 'local-retrieval-fallback' ? '本地检索结果 · 模型回答暂不可用' : '当前课程资料检索'}</span>}
              {message.status === 'explaining' && message.webSearchStatus && <span className="web-search-result-label">{message.webSearchStatus === 'completed' ? '网络补充：已检索并列出来源' : message.webSearchStatus === 'no_results' ? '网络补充：没有找到达到相关性要求的来源' : message.webSearchStatus === 'failed' ? '网络补充：本次检索失败' : '网络补充：未配置，当前仅使用课程资料'}</span>}
              {message.role === 'assistant' && message.status === 'explaining' && (!message.sources || message.sources.length === 0) && <span className="answer-no-evidence">{message.webSearchStatus === 'failed' ? '课程资料没有匹配页面，联网检索本次失败。' : message.webSearchStatus === 'no_results' ? '课程资料没有匹配页面，联网检索也没有找到可靠来源。' : '这次回答没有找到可直接引用的课程页面；联网搜索尚未配置。'}</span>}
              {'evidence' in message && message.evidence.length > 0 && <div className="answer-evidence-list"><span>已保存证据映射</span>{message.evidence.map((item) => <small key={item.id}>{item.evidence_type} · {item.location_label ?? '来源位置'} · {item.support_level}</small>)}</div>}
              {'persistedId' in message && message.role === 'assistant' && message.status === 'explaining' && <div className="answer-feedback-actions"><button type="button" onClick={() => courseId && void api.saveFeedback(courseId, { target_type: 'assistant_message', target_id: message.persistedId!, category: 'helpful' }).then(() => setFeedbackSaved(message.persistedId))}>有帮助</button><button type="button" onClick={() => courseId && void api.saveFeedback(courseId, { target_type: 'assistant_message', target_id: message.persistedId!, category: 'not_helpful' }).then(() => setFeedbackSaved(message.persistedId))}>需改进</button>{feedbackSaved === message.persistedId && <small>反馈已保存</small>}</div>}
              {message.sources?.length ? (
                <div className="answer-sources"><span>回答依据 · 课程课件与网络补充（分开标注）</span>
                  {message.sources.map((source) => (
                    source.source_type === 'web' && source.url ? <a className="source-card web-source-card" key={source.url} href={source.url} target="_blank" rel="noreferrer"><span className="source-card-icon">↗</span><span className="source-card-body"><small className="source-card-meta">网络补充 · {source.site_name} · {source.published_at ? `发布于 ${source.published_at}` : ''} · 检索于 {source.retrieved_at ? new Date(source.retrieved_at).toLocaleDateString('zh-CN') : '刚刚'}</small><strong>{source.title}</strong><small>{source.snippet}</small></span></a> : source.material_id && source.page_number ? <SourceCard key={`${source.material_id}-${source.page_number}`} title={source.lecture_title ?? '课程资料'} pageNumber={source.page_number} quote={source.snippet} onOpen={() => {
                      setSelectedMaterialId(source.material_id ?? undefined)
                      setSelectedPageNumber(source.page_number ?? undefined)
                      if (courseId) navigate(featurePath(courseId, 'materials'))
                    }} /> : null
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          <div ref={chatEndRef} />
        </div>

        {courseContentLoading ? <div className="assistant-no-materials" role="status">正在读取课程资料…</div> : materials.length === 0 && <div className="assistant-no-materials">这门课程还没有资料。上传并解析课件后，答疑才能引用课程内容。{courseId && <Link className="secondary-button link-button" to={featurePath(courseId, 'materials')}>去上传课程资料</Link>}</div>}
        <form className="assistant-question-form" onSubmit={handleSubmit}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="问问当前课程……" rows={3} aria-label="课程问题" />
          <div className="assistant-question-footer"><span>课程检索限定当前课程；{webStatus.configured ? '网络结果会与课件来源分开标注。' : '未配置 Tavily 时只检索课程资料。'}</span><button className="primary-button" type="submit" disabled={!question.trim() || assistantBusy || conversationBusy}>{assistantBusy || conversationBusy ? '正在思考…' : '发送问题'} <span aria-hidden="true">↑</span></button></div>
        </form>
      </section>
    </div>
  )
}
