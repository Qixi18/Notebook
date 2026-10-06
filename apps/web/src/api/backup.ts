import type { BackupPreview, BackupRecord } from '../types'
import { request } from './http'

export const backupApi = {
  exportBackup: (courseId?: string) => request<BackupRecord>('/api/v1/backups/export', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id: courseId }),
  }),
  previewBackup: (file: File) => {
    const form = new FormData(); form.append('file', file)
    return request<BackupPreview>('/api/v1/backups/preview', { method: 'POST', body: form })
  },
  restoreBackup: (file: File, confirmed = false) => {
    const form = new FormData(); form.append('file', file); form.append('confirmed', String(confirmed))
    return request<BackupRecord>('/api/v1/backups/restore', { method: 'POST', body: form })
  },
}
