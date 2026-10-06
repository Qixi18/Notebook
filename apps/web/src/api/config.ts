import { request } from './http'

export type ProviderStatus = { provider: string; configured: boolean; status: string; checked_at: string | null }

export const configApi = {
  getWebSearchStatus: () => request<{ configured: boolean; provider: string; status: string }>('/api/v1/web-search/status'),
  getConfigStatus: () => request<Record<string, ProviderStatus>>('/api/v1/config/status'),
  checkProvider: (provider: 'deepseek' | 'embedding' | 'tavily') => request<ProviderStatus>(`/api/v1/config/check/${provider}`, { method: 'POST' }),
}
