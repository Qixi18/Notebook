import type { Course, DeletionPreview } from '../types'
import { request } from './http'

export const courseApi = {
  listCourses: () => request<Course[]>('/api/v1/courses'),
  listDeletedCourses: () => request<Course[]>('/api/v1/courses/deleted'),
  previewCourseDeletion: (id: string) => request<DeletionPreview>(`/api/v1/courses/${id}/deletion-preview`),
  deleteCourse: (id: string) => request<DeletionPreview>(`/api/v1/courses/${id}`, { method: 'DELETE' }),
  restoreCourse: (id: string) => request<Course>(`/api/v1/courses/${id}/restore`, { method: 'POST' }),
  createCourse: (name: string, description?: string) => request<Course>('/api/v1/courses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || null }),
  }),
}
