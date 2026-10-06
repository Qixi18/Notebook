import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { CourseGate } from '../components/CourseGate'
import {
  featureDescriptions,
  featureLabels,
  type Feature,
  useWorkspace,
} from '../components/AppLayout'
import { TeacherCharacter } from '../components/TeacherCharacter'

const features: Feature[] = ['notes', 'knowledge-tree', 'materials', 'assistant']

export function HomePage() {
  const { courses, coursesLoading, createCourse, busy } = useWorkspace()
  const [requestedFeature, setRequestedFeature] = useState<Feature>()
  const [newCourseName, setNewCourseName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string>()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const state = location.state as { pendingFeature?: Feature } | null
    if (state?.pendingFeature) {
      setRequestedFeature(state.pendingFeature)
      navigate('/', { replace: true, state: null })
    }
  }, [location.state, navigate])

  async function handleCreateCourse(event: FormEvent) {
    event.preventDefault()
    if (!newCourseName.trim() || creating) return
    try {
      setCreating(true)
      setCreateError(undefined)
      const course = await createCourse(newCourseName.trim())
      navigate(`/courses/${course.id}`)
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : '课程创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="home-page page-enter">
      <header className="home-topbar">
        <div>
          <span className="eyebrow">YOUR LOCAL LEARNING SPACE</span>
          <h1>把每门课，学成自己的知识体系。</h1>
          <p>先选一门课程，再从资料、笔记和知识树继续学习。</p>
        </div>
        <span className="local-pill"><span className="local-status-dot" />本机学习空间</span>
      </header>

      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero-copy">
          <span className="hero-kicker"><span>✦</span> 你的课程学习伙伴</span>
          <h2 id="welcome-title">你好，今天想从哪门课开始？</h2>
          <p>创建或选择一门课程。NoteBuddy 会帮你把课件、笔记和知识脉络整理在一起。</p>
          <div className="hero-next-step">
            <span className="hero-next-step-icon">1</span>
            <span><strong>先确定课程</strong><small>之后上传的资料和笔记都会归入这门课</small></span>
          </div>
        </div>
        <TeacherCharacter />
      </section>

      <section className="feature-section" aria-labelledby="feature-heading">
        <div className="section-heading-row">
          <div><span className="eyebrow">学习工具</span><h2 id="feature-heading">选择一个功能</h2></div>
          <span className="section-hint">进入功能前先选择课程</span>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <button className={`feature-card feature-card-${feature}`} key={feature} onClick={() => setRequestedFeature(feature)}>
              <span className="feature-card-icon" aria-hidden="true">
                {feature === 'notes' ? '▤' : feature === 'knowledge-tree' ? '⌘' : feature === 'materials' ? '▱' : '✧'}
              </span>
              <span className="feature-card-copy"><strong>{featureLabels[feature]}</strong><small>{featureDescriptions[feature]}</small></span>
              <span className="feature-card-number">0{index + 1}</span>
              <span className="feature-card-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="courses-section" aria-labelledby="courses-heading">
        <div className="section-heading-row">
          <div><span className="eyebrow">课程是学习起点</span><h2 id="courses-heading">我的课程</h2></div>
          <span className="course-count-label">{courses.length} 门课程</span>
        </div>

        {coursesLoading ? (
          <div className="home-empty-state">正在读取本机课程…</div>
        ) : courses.length ? (
          <div className="home-course-grid">
            {courses.map((course, index) => (
              <button className="home-course-card" key={course.id} onClick={() => navigate(`/courses/${course.id}`)}>
                <span className={`home-course-symbol home-course-symbol-${index % 3}`}>{course.name.slice(0, 1)}</span>
                <span className="home-course-copy"><strong>{course.name}</strong><small>创建于 {new Date(course.created_at).toLocaleDateString('zh-CN')}</small></span>
                <span className="home-course-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="home-empty-state">
            <span className="empty-state-mark">＋</span>
            <div><strong>还没有课程</strong><p>新建一门课程，把相关课件、笔记和知识点集中整理。</p></div>
          </div>
        )}

        <form className="home-create-course" onSubmit={handleCreateCourse}>
          <label htmlFor="home-course-name">新建课程</label>
          <div className="home-create-course-row">
            <input
              id="home-course-name"
              value={newCourseName}
              onChange={(event) => setNewCourseName(event.target.value)}
              placeholder="输入课程名称，例如：软件工程"
              maxLength={120}
            />
            <button className="primary-button" type="submit" disabled={!newCourseName.trim() || creating || busy}>
              {creating ? '正在创建…' : '创建课程'}
            </button>
          </div>
          {createError && <p className="form-error" role="alert">{createError}</p>}
        </form>
      </section>

      {requestedFeature && (
        <CourseGate feature={requestedFeature} onClose={() => setRequestedFeature(undefined)} />
      )}
    </div>
  )
}
