import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { Outlet, useBlocker, useLocation, useNavigate } from 'react-router-dom'

import type {
  AssistantResponse,
  Course,
  Job,
  KnowledgeGraph,
  Material,
  Note,
  Page,
} from '../types'
import { CourseSwitcher } from './CourseSwitcher'

export type Feature = 'notes' | 'knowledge-tree' | 'materials' | 'assistant'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantResponse['sources']
  mode?: string
  status?: 'idle' | 'thinking' | 'explaining' | 'error'
  webSearchStatus?: 'unavailable' | 'failed' | 'no_results' | 'completed'
}

export type WorkspaceContextValue = {
  courses: Course[]
  courseId?: string
  course?: Course
  coursesLoading: boolean
  courseContentLoading: boolean
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
  assistantBusy: boolean
  noteSaving: boolean
  noteDirty: boolean
  reloadNote: () => Promise<void>
  error?: string
  setError: (message: string | undefined) => void
  createCourse: (name: string) => Promise<Course>
  uploadMaterial: (file: File, lectureTitle: string, topicTitle?: string, allowDuplicate?: boolean) => Promise<void>
  retryMaterial: (materialId: string) => Promise<void>
  reparseMaterial: (materialId: string) => Promise<void>
  requestOCR: (materialId: string) => Promise<void>
  saveNote: () => Promise<void>
  messages: ChatMessage[]
  question: string
  setQuestion: (value: string) => void
  askQuestion: (materialId?: string, pageNumber?: number) => Promise<void>
  refreshCourses: () => Promise<void>
  refreshCurrentMaterials: () => Promise<void>
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
  const { courseId, course, courses, coursesLoading, error, setError, noteDirty } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const activeFeature = location.pathname.split('/')[3] as Feature | undefined
  const blocker = useBlocker(({ currentLocation, nextLocation }) => noteDirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('笔记有尚未保存的修改。离开将丢失这些内容，仍要继续吗？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!noteDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [noteDirty])

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

        <CourseSwitcher
          course={course}
          courses={courses}
          loading={coursesLoading}
          onSelect={(nextCourseId) => {
            const feature = activeFeature && featureLabels[activeFeature] ? activeFeature : undefined
            navigate(feature ? featurePath(nextCourseId, feature) : `/courses/${nextCourseId}`)
          }}
        />

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
