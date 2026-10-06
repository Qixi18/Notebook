import { assistantApi } from './api/assistant'
import { configApi } from './api/config'
import { courseApi } from './api/courses'
import { knowledgeApi } from './api/knowledge'
import { materialApi } from './api/materials'
import { noteApi } from './api/notes'

export { ApiError } from './api/http'
export type { ProviderStatus } from './api/config'

export const api = {
  ...courseApi,
  ...materialApi,
  ...noteApi,
  ...knowledgeApi,
  ...assistantApi,
  ...configApi,
}
