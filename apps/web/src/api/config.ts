import { request } from './http'

export type ProviderStatus = { provider: string; configured: boolean; status: string; checked_at: string | null }
export type OCRStatus = { enabled: boolean; available: boolean; status: string; provider: string; max_pages: number; language: string; timeout_seconds: number }
export type Capabilities = { allowed_extensions: string[]; max_upload_bytes: number; max_pages: number; ocr: OCRStatus }

export const configApi = {
  getWebSearchStatus: () => request<{ configured: boolean; provider: string; status: string }>('/api/v1/web-search/status'),
  getConfigStatus: () => request<Record<string, ProviderStatus>>('/api/v1/config/status'),
  checkProvider: (provider: 'deepseek' | 'embedding' | 'tavily') => request<ProviderStatus>(`/api/v1/config/check/${provider}`, { method: 'POST' }),
  getCapabilities: () => request<Capabilities>('/api/v1/config/capabilities'),
  getOCRStatus: () => request<OCRStatus>('/api/v1/ocr/status'),
}
