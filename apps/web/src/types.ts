export type Course = {
  id: string
  name: string
  description: string | null
  created_at: string
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

export type NoteRevision = {
  id: string
  note_id: string
  revision_number: number
  content_markdown: string
  content_origin: string
  user_locked: boolean
  created_at: string
}

export type NoteSourceRef = {
  id: string
  page_block_id: string
  source_type: string
  quote: string
  material_id: string
  page_number: number
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
