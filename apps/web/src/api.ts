import type {
  AssistantResponse,
  Course,
  KnowledgeGraph,
  Job,
  Material,
  Note,
  NoteRevision,
  NoteSourceRef,
  Page,
  UploadResponse,
} from './types'

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const body = await response.text()
    let detail = body
    try {
      const parsed = JSON.parse(body) as { detail?: string }
      detail = parsed.detail ?? body
    } catch {
      // Keep plain-text upstream error bodies readable.
    }
    throw new ApiError(detail || `请求失败：${response.status}`, response.status)
  }
  return response.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = {
  listCourses: () => request<Course[]>('/api/v1/courses'),
  createCourse: (name: string, description?: string) =>
    request<Course>('/api/v1/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || null }),
    }),
  listMaterials: (courseId: string) => request<Material[]>(`/api/v1/courses/${courseId}/materials`),
  uploadMaterial: (courseId: string, file: File, lectureTitle: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('lecture_title', lectureTitle)
    return request<UploadResponse>(`/api/v1/courses/${courseId}/materials`, {
      method: 'POST',
      body: form,
    })
  },
  getJob: (jobId: string) => request<Job>(`/api/v1/jobs/${jobId}`),
  listPages: (materialId: string) => request<Page[]>(`/api/v1/materials/${materialId}/pages`),
  listNotes: (courseId: string) => request<Note[]>(`/api/v1/courses/${courseId}/notes`),
  getNoteRevisions: (noteId: string) => request<NoteRevision[]>(`/api/v1/notes/${noteId}/revisions`),
  getNoteSources: (noteId: string) => request<NoteSourceRef[]>(`/api/v1/notes/${noteId}/sources`),
  getKnowledgeGraph: (courseId: string) =>
    request<KnowledgeGraph>(`/api/v1/courses/${courseId}/knowledge-graph`),
  updateNote: (noteId: string, contentMarkdown: string, expectedRevisionNumber: number) =>
    request<Note>(`/api/v1/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_markdown: contentMarkdown,
        expected_revision_number: expectedRevisionNumber,
      }),
    }),
  askAssistant: (courseId: string, question: string, materialId?: string, pageNumber?: number) =>
    request<AssistantResponse>(`/api/v1/courses/${courseId}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, material_id: materialId, page_number: pageNumber }),
    }),
}
