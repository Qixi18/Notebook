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

