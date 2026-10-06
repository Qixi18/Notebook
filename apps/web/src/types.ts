export type Course = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export type CourseDeleteResponse = {
  deleted_course_id: string
  deleted_materials: number
  deleted_pages: number
  deleted_knowledge_nodes: number
  deleted_notes: number
}

export type Material = {
  id: string
  course_id: string
  lecture_title: string
  original_filename: string
  media_type: string | null
  size_bytes: number
  status: string
  page_count: number
  created_at: string
}

export type Job = {
  id: string
  material_id: string
  kind: string
  status: string
  progress: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export type Page = {
  id: string
  material_id: string
  page_number: number
  title: string | null
  raw_text: string
  parse_status: string
  warning: string | null
}

export type UploadResponse = {
  material: Material
  job: Job
}

export type AssistantSource = {
  material_id: string
  lecture_title: string
  page_number: number
  snippet: string
}

export type AssistantResponse = {
  answer: string
  sources: AssistantSource[]
  mode: string
}

export type Note = {
  id: string
  course_id: string
  knowledge_node_id: string
  title: string
  content_markdown: string
  content_origin: string
  user_locked: boolean
  revision_number: number
  created_at: string
  updated_at: string
}

export type KnowledgeNode = {
  id: string
  course_id: string
  name: string
  summary: string | null
  status: string
}

export type KnowledgeEdge = {
  id: string
  course_id: string
  source_node_id: string
  target_node_id: string
  relation_type: string
  confidence: number | null
  created_by: string
}

export type KnowledgeGraph = {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export type DeepSeekStatus = {
  configured: boolean
  masked_key: string | null
  base_url: string
  model: string
  timeout_seconds: number
}

export type EmbeddingStatus = {
  configured: boolean
  masked_key: string | null
  base_url: string | null
  model: string | null
}

export type StorageStatus = {
  data_dir: string
  database: string
  max_upload_mb: number
}

export type LimitsStatus = {
  allowed_extensions: string[]
  editable_keys: string[]
  secret_write_enabled: boolean
  token_required: boolean
}

export type SettingsSource = {
  env_path: string
  env_exists: boolean
  override_keys: string[]
}

export type SettingsStatus = {
  deepseek: DeepSeekStatus
  embedding: EmbeddingStatus
  storage: StorageStatus
  limits: LimitsStatus
  source: SettingsSource
}

export type SettingsUpdateResponse = {
  updated: string[]
  backup_path: string | null
  status: SettingsStatus
  warnings: string[]
}
