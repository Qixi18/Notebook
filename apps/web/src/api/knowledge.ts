import type { KnowledgeGraph } from '../types'
import { request } from './http'

export const knowledgeApi = {
  getKnowledgeGraph: (courseId: string) => request<KnowledgeGraph>(`/api/v1/courses/${courseId}/knowledge-graph`),
}
