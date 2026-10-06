export async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
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
