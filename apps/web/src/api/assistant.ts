import type { AssistantResponse } from '../types'
import { request } from './http'

export const assistantApi = {
  askAssistant: (courseId: string, question: string, materialId?: string, pageNumber?: number, allowWeb = true, learningGoal?: string) =>
    request<AssistantResponse>(`/api/v1/courses/${courseId}/assistant`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, material_id: materialId, page_number: pageNumber, allow_web: allowWeb, learning_goal: learningGoal }),
    }),
}
