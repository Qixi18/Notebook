export type Course = {
  id: string
  name: string
  description: string | null
  created_at: string
  deleted_at?: string | null
}

export type Material = {
  id: string
  course_id: string
  lecture_title: string
  topic_title: string | null
  original_filename: string
  media_type: string | null
  size_bytes: number
  status: string
  page_count: number
  created_at: string
  deleted_at?: string | null
}

export type Job = {
  id: string
  material_id: string
  kind: string
  status: string
  progress: number
  error_message: string | null
  phase: string
  web_search_status: string
  created_at: string
  updated_at: string
  error_code?: string | null
  attempt_count?: number
}

export type DeletionPreview = {
  course_id: string
  material_id: string | null
  materials: number
  pages: number
  source_refs: number
  knowledge_nodes_touched: number
  user_notes_protected: number
  original_bytes: number
  active_jobs: number
  action: string
}

export type Page = {
  id: string
  material_id: string
  page_number: number
  title: string | null
  raw_text: string
  parse_status: string
  warning: string | null
  location_type: string
  location_label: string | null
  stable_location_key: string | null
  extraction_method: string
  confidence: number | null
}

export type CoverageLocation = {
  page_id: string
  page_number: number
  location_type: string
  location_label: string
  stable_location_key: string | null
  status: 'cited' | 'review'
  citation_count: number
  note_ids: string[]
  note_titles: string[]
  warning: string | null
}

export type Coverage = {
  material_id: string
  total_locations: number
  cited_locations: number
  review_locations: number
  locations: CoverageLocation[]
}

export type UploadResponse = {
  material: Material
  job: Job
}

export type AssistantSource = {
  source_type: 'course_material' | 'web'
  material_id?: string | null
  lecture_title?: string | null
  page_number?: number | null
  snippet: string
  title?: string | null
  url?: string | null
  site_name?: string | null
  retrieved_at?: string | null
  published_at?: string | null
}

export type WebSource = {
  id: string
  title: string
  url: string
  site_name: string
  snippet: string
  search_query: string
  score: number | null
  published_at: string | null
  retrieved_at: string
}

export type AssistantResponse = {
  answer: string
  sources: AssistantSource[]
  mode: string
  web_search_status: 'unavailable' | 'failed' | 'no_results' | 'completed'
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
  location_type?: string
  location_label?: string | null
  status?: string
}

export type KnowledgeNode = {
  id: string
  course_id: string
  name: string
  summary: string | null
  status: string
  sources: KnowledgeNodeSource[]
}

export type KnowledgeNodeSource = {
  material_id: string
  lecture_title: string
  topic_title?: string | null
  page_number: number
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
