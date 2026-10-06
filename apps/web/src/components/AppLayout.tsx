import { createContext, useContext, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import type {
  AssistantResponse,
  Course,
  Job,
  KnowledgeGraph,
  Material,
  Note,
  Page,
} from '../types'

export type Feature = 'notes' | 'knowledge-tree' | 'materials' | 'assistant'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantResponse['sources']
}

export type WorkspaceContextValue = {
  courses: Course[]
  courseId?: string
  course?: Course
  coursesLoading: boolean
  materials: Material[]
  selectedMaterialId?: string
  setSelectedMaterialId: (id: string | undefined) => void
  pages: Page[]
  selectedPageNumber?: number
  setSelectedPageNumber: (page: number | undefined) => void
  notes: Note[]
  selectedNote?: Note
  setSelectedNoteId: (id: string | undefined) => void
  noteDraft: string
  setNoteDraft: (value: string) => void
  editingNote: boolean
  setEditingNote: (editing: boolean) => void
  graph: KnowledgeGraph
  job?: Job
  busy: boolean
  noteSaving: boolean
  error?: string
  setError: (message: string | undefined) => void
  createCourse: (name: string) => Promise<Course>
  uploadMaterial: (file: File, lectureTitle: string) => Promise<void>
  saveNote: () => Promise<void>
  messages: ChatMessage[]
  question: string
  setQuestion: (value: string) => void
  askQuestion: () => Promise<void>
  refreshCourses: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue
  children: ReactNode
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}

const featureLabels: Record<Feature, string> = {
  notes: '笔记',
  'knowledge-tree': '知识树',
  materials: '课程资料',
  assistant: 'AI 答疑',
}

const featureDescriptions: Record<Feature, string> = {
  notes: '整理与编辑课程笔记',
  'knowledge-tree': '查看课程知识结构',
  materials: '上传课件并检查解析结果',
  assistant: '基于当前课程资料提问',
}

export function featurePath(courseId: string, feature: Feature): string {
  return `/courses/${courseId}/${feature}`
}

export function AppLayout() {
  const { courseId, course, courses, coursesLoading, error, setError } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const activeFeature = location.pathname.split('/')[3] as Feature | undefined

  function openFeature(feature: Feature) {
    if (courseId) {
      navigate(featurePath(courseId, feature))
    } else {
      navigate('/', { state: { pendingFeature: feature } })
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <button className="brand-lockup" onClick={() => navigate('/')} aria-label="返回首页">
          <span className="brand-mark">N</span>
          <span><strong>NoteBuddy</strong><small>课程学习空间</small></span>
        </button>

        <div className="sidebar-section-label">学习空间</div>
        <button className={`sidebar-link ${location.pathname === '/' ? 'sidebar-link-active' : ''}`} onClick={() => navigate('/')}>
          <span className="sidebar-link-icon">⌂</span>首页
        </button>
        {(Object.keys(featureLabels) as Feature[]).map((feature) => (
          <button
            className={`sidebar-link ${activeFeature === feature ? 'sidebar-link-active' : ''}`}
            key={feature}
            onClick={() => openFeature(feature)}
          >
            <span className="sidebar-link-icon" aria-hidden="true">
              {feature === 'notes' ? '▤' : feature === 'knowledge-tree' ? '⌘' : feature === 'materials' ? '▱' : '✧'}
            </span>
            {featureLabels[feature]}
          </button>
        ))}

        <div className="sidebar-course-block">
          <div className="sidebar-section-label">当前课程</div>
          {course ? (
            <label className="course-switcher-label">
              <span className="course-dot" />
              <select
                className="course-switcher"
                aria-label="切换当前课程"
                value={course.id}
                onChange={(event) => {
                  const nextCourseId = event.target.value
                  const feature = activeFeature && featureLabels[activeFeature] ? activeFeature : undefined
                  navigate(feature ? featurePath(nextCourseId, feature) : `/courses/${nextCourseId}`)
                }}
              >
                {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : (
            <button className="current-course-empty" onClick={() => navigate('/')}>
              {coursesLoading ? '正在读取课程…' : courses.length ? '请选择一门课程' : '先创建一门课程'}
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <span className="local-status-dot" />本地学习空间 · 数据保存在本机
        </div>
      </aside>

      <main className="app-main">
        {error && (
          <div className="global-alert" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(undefined)} aria-label="关闭提示">×</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

export { featureLabels, featureDescriptions }
