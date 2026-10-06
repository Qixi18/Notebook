import type { KnowledgeChange, KnowledgeGraph, KnowledgeProposal } from '../types'
import { request } from './http'

export const knowledgeApi = {
  getKnowledgeGraph: (courseId: string) => request<KnowledgeGraph>(`/api/v1/courses/${courseId}/knowledge-graph`),
  listKnowledgeProposals: (courseId: string, status?: string) => request<KnowledgeProposal[]>(`/api/v1/courses/${courseId}/knowledge-proposals${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  listKnowledgeChanges: (courseId: string) => request<KnowledgeChange[]>(`/api/v1/courses/${courseId}/knowledge-changes`),
  reviewKnowledgeProposal: (proposalId: string, decision: 'confirm' | 'reject', note?: string) => request<KnowledgeProposal>(`/api/v1/knowledge-proposals/${proposalId}/review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note }),
  }),
}
