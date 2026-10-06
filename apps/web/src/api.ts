import type {
  AssistantResponse,
  Course,
  CourseDeleteResponse,
  KnowledgeGraph,
  Job,
  Material,
  Note,
  Page,
  SettingsStatus,
  SettingsUpdateResponse,
  UploadResponse,
} from './types'

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `请求失败：${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  listCourses: () => request<Course[]>('/api/v1/courses'),
  createCourse: (name: string, description?: string) =>
    request<Course>('/api/v1/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || null }),
    }),
  renameCourse: (courseId: string, name: string) =>
    request<Course>(`/api/v1/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  deleteCourse: (courseId: string) =>
    request<CourseDeleteResponse>(`/api/v1/courses/${courseId}`, { method: 'DELETE' }),
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
  getSettings: () => request<SettingsStatus>('/api/v1/settings'),
  updateSettings: (updates: Record<string, string>, token?: string) =>
    request<SettingsUpdateResponse>('/api/v1/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Notebook-Settings-Token': token } : {}),
      },
      body: JSON.stringify(updates),
    }),
}
