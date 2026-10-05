import type {
  AssistantResponse,
  Course,
  Job,
  Material,
  Page,
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
  askAssistant: (courseId: string, question: string, materialId?: string, pageNumber?: number) =>
    request<AssistantResponse>(`/api/v1/courses/${courseId}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, material_id: materialId, page_number: pageNumber }),
    }),
}

