import { useEffect, useRef, useState } from 'react'

import { api } from '../../api'
import type { ChatMessage } from '../../components/AppLayout'

const initialMessage: ChatMessage = {
  role: 'assistant',
  content: '你好，我会优先从当前课程已解析的页面中寻找回答依据。',
}

export function useAssistantState(courseId?: string) {
  const courseRef = useRef(courseId)
  courseRef.current = courseId
  const [question, setQuestion] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage])

  useEffect(() => {
    setMessages([initialMessage])
    setQuestion('')
    setAssistantBusy(false)
  }, [courseId])

  async function askQuestion(materialScope?: string, pageScope?: number) {
    const currentQuestion = question.trim()
    if (!courseId || !currentQuestion || assistantBusy) return
    const requestCourseId = courseId
    setMessages((current) => [...current, { role: 'user', content: currentQuestion }])
    setQuestion('')
    setAssistantBusy(true)
    try {
      const response = await api.askAssistant(requestCourseId, currentQuestion, materialScope, pageScope)
      if (courseRef.current !== requestCourseId) return
      setMessages((current) => [...current, { role: 'assistant', content: response.answer, sources: response.sources, claims: response.claims, mode: response.mode, status: 'explaining', webSearchStatus: response.web_search_status }])
    } catch (cause) {
      if (courseRef.current !== requestCourseId) return
      setMessages((current) => [...current, {
        role: 'assistant',
        content: cause instanceof Error ? cause.message : '问答请求失败',
        status: 'error',
      }])
    } finally {
      if (courseRef.current === requestCourseId) setAssistantBusy(false)
    }
  }

  return { question, setQuestion, assistantBusy, messages, askQuestion }
}
