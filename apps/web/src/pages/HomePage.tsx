import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { CourseGate } from '../components/CourseGate'
import { BackupPanel } from '../components/BackupPanel'
import { DiagnosticsPanel } from '../components/DiagnosticsPanel'
import {
  featureDescriptions,
  featureLabels,
  type Feature,
  useWorkspace,
} from '../components/AppLayout'
import { TeacherCharacter } from '../components/TeacherCharacter'
import { api, type ProviderStatus } from '../api'
import type { Course, DeletionPreview, Material } from '../types'

const features: Feature[] = ['notes', 'knowledge-tree', 'materials', 'assistant']

export function HomePage() {
  const { courses, coursesLoading, createCourse, refreshCourses, busy } = useWorkspace()
  const [requestedFeature, setRequestedFeature] = useState<Feature>()
  const [newCourseName, setNewCourseName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string>()
  const [attentionMaterials, setAttentionMaterials] = useState<Material[]>([])
  const [materialCounts, setMaterialCounts] = useState<Record<string, number>>({})
  const [deletedCourses, setDeletedCourses] = useState<Course[]>([])
  const [courseActionError, setCourseActionError] = useState<string>()
  const [providerStates, setProviderStates] = useState<Record<string, ProviderStatus>>({})
  const [checkingProvider, setCheckingProvider] = useState<string>()
  const [ocrStatus, setOcrStatus] = useState<{ status: string; available: boolean }>()
  const [backupBusy, setBackupBusy] = useState<string>()
  const [backupMessage, setBackupMessage] = useState<string>()
  const [courseRemoval, setCourseRemoval] = useState<{ course: Course; impact: DeletionPreview }>()
  const [removingCourse, setRemovingCourse] = useState(false)
  const [showCreateCourseDialog, setShowCreateCourseDialog] = useState(false)
  const courseListRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isModalOpen = showCreateCourseDialog || Boolean(courseRemoval)

  useEffect(() => {
    if (!isModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isModalOpen])

  useEffect(() => {
    if (!isModalOpen) return
    function handleModalKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (showCreateCourseDialog && !creating) setShowCreateCourseDialog(false)
      if (courseRemoval && !removingCourse) setCourseRemoval(undefined)
    }
    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [isModalOpen, showCreateCourseDialog, creating, courseRemoval, removingCourse])

  useEffect(() => {
    void api.getConfigStatus().then(setProviderStates).catch(() => setProviderStates({}))
    void api.getOCRStatus().then(setOcrStatus).catch(() => setOcrStatus(undefined))
  }, [])

  async function testProvider(provider: 'deepseek' | 'embedding' | 'tavily') {
    try {
      setCheckingProvider(provider)
      const status = await api.checkProvider(provider)
      setProviderStates((current) => ({ ...current, [provider]: status }))
    } catch (cause) { setCourseActionError(cause instanceof Error ? cause.message : '连接检查失败') }
    finally { setCheckingProvider(undefined) }
  }

  useEffect(() => {
    let active = true
    void api.listDeletedCourses().then((items) => { if (active) setDeletedCourses(items) }).catch(() => { if (active) setDeletedCourses([]) })
    return () => { active = false }
  }, [courses])

  async function requestCourseRemoval(course: Course) {
    try {
      const impact = await api.previewCourseDeletion(course.id)
      if (impact.active_jobs) throw new Error('课程仍有处理任务，请完成后再删除。')
      setCourseRemoval({ course, impact })
      setCourseActionError(undefined)
    } catch (cause) { setCourseActionError(cause instanceof Error ? cause.message : '课程移除预览失败') }
  }

  async function confirmCourseRemoval() {
    if (!courseRemoval || removingCourse) return
    try {
      setRemovingCourse(true)
      await api.deleteCourse(courseRemoval.course.id)
      setCourseRemoval(undefined)
      await refreshCourses()
      setCourseActionError(undefined)
    } catch (cause) { setCourseActionError(cause instanceof Error ? cause.message : '课程移除失败') }
    finally { setRemovingCourse(false) }
  }

  async function restoreCourse(id: string) {
    try { await api.restoreCourse(id); await refreshCourses(); setCourseActionError(undefined) }
    catch (cause) { setCourseActionError(cause instanceof Error ? cause.message : '课程恢复失败') }
  }

  async function exportCourseBackup(course: Course) {
    try {
      setBackupBusy(course.id)
      setBackupMessage(undefined)
      const record = await api.exportBackup(course.id)
      setBackupMessage(record.status === 'completed' ? `“${course.name}”的备份已生成：${record.path}` : record.error_message ?? '备份失败')
    } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : '备份失败') }
    finally { setBackupBusy(undefined) }
  }

  function showCourses() {
    courseListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openCreateCourse() {
    setNewCourseName('')
    setCreateError(undefined)
    setShowCreateCourseDialog(true)
  }

  useEffect(() => {
    let active = true
    if (!courses.length) { setAttentionMaterials([]); return () => { active = false } }
    void Promise.all(courses.map((course) => api.listMaterials(course.id)))
      .then((collections) => { if (active) {
        setMaterialCounts(Object.fromEntries(courses.map((course, index) => [course.id, collections[index].length])))
        setAttentionMaterials(collections.flat().filter((material) => material.status === 'pending' || material.status === 'processing' || material.status === 'failed').slice(0, 4))
      } })
      .catch(() => { if (active) setAttentionMaterials([]) })
    return () => { active = false }
  }, [courses])

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
      setShowCreateCourseDialog(false)
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
          <h1>我的学习空间</h1>
          <p>从课程出发，把资料、笔记和知识慢慢整理起来。</p>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero-copy">
          <h2 id="welcome-title">你好，今天想从哪门课开始？</h2>
          <p>每门课程都有自己的资料、笔记和知识树。选一门继续，或创建一个新的学习空间。</p>
          <div className="home-hero-actions">
            <button className="primary-button" type="button" onClick={openCreateCourse}>＋ 新建课程</button>
            <button className="secondary-button" type="button" onClick={showCourses}>浏览已有课程</button>
          </div>
        </div>
        <TeacherCharacter />
      </section>

      <details className="home-secondary-panel">
        <summary><span><strong>连接、诊断与备份</strong><small>可选服务状态 · 本机运行情况 · 课程数据保护</small></span><span className="home-secondary-chevron" aria-hidden="true">⌄</span></summary>
      <section className="courses-section home-secondary-services" aria-label="外部服务状态">
        <div className="section-heading-row"><div><span className="eyebrow">本地配置</span><h2>可选服务状态</h2></div></div>
        {(['deepseek', 'embedding', 'tavily'] as const).map((provider) => <div key={provider}>
          <span>{provider}：{providerStates[provider]?.status === 'connected' ? '连接成功' : providerStates[provider]?.status === 'configured_untested' ? '已配置，尚未测试' : providerStates[provider]?.status === 'authentication_failed' ? '认证失败' : providerStates[provider]?.status === 'rate_limited' ? '调用受限' : providerStates[provider]?.status === 'timeout' ? '连接超时' : providerStates[provider]?.status === 'unavailable' ? '暂不可用' : '未配置'}</span>
          {providerStates[provider]?.configured && <button className="text-button" disabled={Boolean(checkingProvider)} onClick={() => void testProvider(provider)}>{checkingProvider === provider ? '检查中…' : '主动测试连接'}</button>}
        </div>)}
        <p>连接测试会向对应服务发送一个最小请求，可能产生少量调用费用。密钥仅保存在本机后端配置中。</p>
        <p>OCR：{ocrStatus?.status === 'ready' ? '已启用并可用' : ocrStatus?.status === 'missing_dependency' ? '已配置但缺少本机依赖' : '未启用'}。扫描页会保留候选状态，不伪造原文。</p>
      </section>

      <DiagnosticsPanel />
      <BackupPanel />
      </details>

      <section className="feature-section" aria-labelledby="feature-heading">
        <div className="section-heading-row">
          <div><span className="eyebrow">学习工具</span><h2 id="feature-heading">快速入口</h2></div>
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

      <section className="courses-section home-courses-section" aria-labelledby="courses-heading" ref={courseListRef}>
        <div className="section-heading-row">
          <div><h2 id="courses-heading">我的课程</h2><p>选择课程继续学习，课程内容会保存在本机。</p></div>
          <span className="course-count-label">{courses.length} 门课程</span>
        </div>

        {coursesLoading ? (
          <div className="home-empty-state">正在读取本机课程…</div>
        ) : courses.length ? (
          <div className="home-course-grid">
            {courses.map((course, index) => (
              <article className="home-course-entry" key={course.id}>
                <button className="home-course-card" onClick={() => navigate(`/courses/${course.id}`)} aria-label={`打开课程：${course.name}`}>
                  <span className={`home-course-symbol home-course-symbol-${index % 3}`}>{course.name.slice(0, 1)}</span>
                  <span className="home-course-copy"><strong>{course.name}</strong><small>{materialCounts[course.id] ?? 0} 份资料 · {getLastVisited(course.id) ? `最近学习 ${new Date(getLastVisited(course.id)!).toLocaleDateString('zh-CN')}` : `创建于 ${new Date(course.created_at).toLocaleDateString('zh-CN')}`}</small></span>
                  <span className="home-course-arrow" aria-hidden="true">→</span>
                </button>
                <details className="home-course-actions">
                  <summary aria-label={`管理课程：${course.name}`} title="课程操作">···</summary>
                  <div className="home-course-action-menu">
                    <button type="button" disabled={backupBusy === course.id} onClick={() => void exportCourseBackup(course)}>{backupBusy === course.id ? '正在生成备份…' : '导出课程备份'}</button>
                    <button className="home-course-remove-action" type="button" onClick={() => void requestCourseRemoval(course)}>移除课程</button>
                  </div>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <div className="home-empty-state">
            <span className="empty-state-mark">＋</span>
            <div><strong>还没有课程</strong><p>创建第一门课程，再上传课件、整理笔记和知识点。</p><button className="text-button" type="button" onClick={openCreateCourse}>创建第一门课程 →</button></div>
          </div>
        )}
        {courseActionError && <p className="form-error" role="alert">{courseActionError}</p>}
        {backupMessage && <p className="form-success" role="status">{backupMessage}</p>}
        {deletedCourses.length > 0 && <details className="home-restored-courses"><summary>可恢复的课程 · {deletedCourses.length}</summary>{deletedCourses.map((course) => <div className="home-restored-course" key={course.id}><span>{course.name}</span><button className="text-button" onClick={() => void restoreCourse(course.id)}>恢复课程</button></div>)}</details>}
      </section>

      {attentionMaterials.length > 0 && <section className="home-attention-section" aria-label="需要关注的资料"><div className="section-heading-row"><div><span className="eyebrow">课程处理提醒</span><h2>需要关注</h2></div></div><div className="home-attention-list">{attentionMaterials.map((material) => {
        const course = courses.find((item) => item.id === material.course_id)
        return <button className={`home-attention-item home-attention-${material.status}`} key={material.id} onClick={() => navigate(`/courses/${material.course_id}/materials`)}><span className="home-attention-mark">{material.status === 'failed' ? '!' : '·'}</span><span><strong>{course?.name} · {material.lecture_title}</strong><small>{material.status === 'failed' ? '解析失败，打开资料查看错误并重试。' : material.status === 'pending' ? '资料等待处理。' : '资料正在解析。'}</small></span><span aria-hidden="true">→</span></button>
      })}</div></section>}

      {requestedFeature && (
        <CourseGate feature={requestedFeature} onClose={() => setRequestedFeature(undefined)} />
      )}
      {showCreateCourseDialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setShowCreateCourseDialog(false) }}>
        <section className="course-gate-modal home-course-create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-course-title">
          <button className="modal-close" type="button" onClick={() => setShowCreateCourseDialog(false)} disabled={creating} aria-label="关闭">×</button>
          <span className="eyebrow">新的学习空间</span>
          <h2 id="create-course-title">创建课程</h2>
          <p className="muted-copy">课程资料、笔记和知识树会分别保存在这个空间中。</p>
          <form className="home-create-course" onSubmit={handleCreateCourse}>
            <label htmlFor="home-course-name">课程名称</label>
            <div className="home-create-course-row">
              <input id="home-course-name" autoFocus value={newCourseName} onChange={(event) => setNewCourseName(event.target.value)} placeholder="例如：软件工程" maxLength={120} />
              <button className="primary-button" type="submit" disabled={!newCourseName.trim() || creating || busy}>{creating ? '正在创建…' : '创建并打开'}</button>
            </div>
            {createError && <p className="form-error" role="alert">{createError}</p>}
          </form>
        </section>
      </div>}
      {courseRemoval && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !removingCourse) setCourseRemoval(undefined) }}>
        <section className="course-gate-modal home-course-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-course-title">
          <button className="modal-close" type="button" onClick={() => setCourseRemoval(undefined)} disabled={removingCourse} aria-label="关闭">×</button>
          <span className="eyebrow">课程数据管理</span>
          <h2 id="remove-course-title">移除“{courseRemoval.course.name}”？</h2>
          <p className="muted-copy">课程会从列表中隐藏，系统会先自动备份。之后可在“可恢复的课程”中恢复。</p>
          <div className="course-delete-impact">
            <span><strong>{courseRemoval.impact.materials}</strong><small>份资料</small></span>
            <span><strong>{courseRemoval.impact.pages}</strong><small>个页面</small></span>
            <span><strong>{courseRemoval.impact.user_notes_protected}</strong><small>条已保护笔记</small></span>
          </div>
          <div className="home-course-delete-actions">
            <button className="secondary-button" type="button" onClick={() => setCourseRemoval(undefined)} disabled={removingCourse}>保留课程</button>
            <button className="danger-button" type="button" onClick={() => void confirmCourseRemoval()} disabled={removingCourse}>{removingCourse ? '正在移除…' : '确认移除课程'}</button>
          </div>
        </section>
      </div>}
    </div>
  )
}

function getLastVisited(courseId: string): string | null {
  try { return localStorage.getItem(`notebuddy.course.${courseId}.lastVisited`) } catch { return null }
}
