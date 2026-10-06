import type { TermExplanation } from '../types'
import { request } from './http'

export const termsApi = {
  explainTerm: (courseId: string, term: string, discipline?: string) => request<TermExplanation>(`/api/v1/courses/${courseId}/terms/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term, discipline }),
  }),
}
