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
import { api, type ProviderStatus } from '../api'
import type { Course, Material } from '../types'

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
  const location = useLocation()
  const navigate = useNavigate()

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

  async function deleteCourse(id: string) {
    try {
      const impact = await api.previewCourseDeletion(id)
      if (impact.active_jobs) throw new Error('课程仍有处理任务，请完成后再删除。')
      if (!window.confirm(`移除这门课程？将隐藏 ${impact.materials} 份资料、${impact.pages} 个页面和 ${impact.user_notes_protected} 条已保护笔记。操作前会自动备份，可从下方恢复。`)) return
      await api.deleteCourse(id)
      await refreshCourses()
      setCourseActionError(undefined)
    } catch (cause) { setCourseActionError(cause instanceof Error ? cause.message : '课程移除失败') }
  }

  async function restoreCourse(id: string) {
    try { await api.restoreCourse(id); await refreshCourses(); setCourseActionError(undefined) }
    catch (cause) { setCourseActionError(cause instanceof Error ? cause.message : '课程恢复失败') }
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

      <section className="courses-section" aria-label="外部服务状态">
        <div className="section-heading-row"><div><span className="eyebrow">本地配置</span><h2>可选服务状态</h2></div></div>
        {(['deepseek', 'embedding', 'tavily'] as const).map((provider) => <div key={provider}>
          <span>{provider}：{providerStates[provider]?.status === 'connected' ? '连接成功' : providerStates[provider]?.status === 'configured_untested' ? '已配置，尚未测试' : providerStates[provider]?.status === 'authentication_failed' ? '认证失败' : providerStates[provider]?.status === 'rate_limited' ? '调用受限' : providerStates[provider]?.status === 'timeout' ? '连接超时' : providerStates[provider]?.status === 'unavailable' ? '暂不可用' : '未配置'}</span>
          {providerStates[provider]?.configured && <button className="text-button" disabled={Boolean(checkingProvider)} onClick={() => void testProvider(provider)}>{checkingProvider === provider ? '检查中…' : '主动测试连接'}</button>}
        </div>)}
        <p>连接测试会向对应服务发送一个最小请求，可能产生少量调用费用。密钥仅保存在本机后端配置中。</p>
        <p>OCR：{ocrStatus?.status === 'ready' ? '已启用并可用' : ocrStatus?.status === 'missing_dependency' ? '已配置但缺少本机依赖' : '未启用'}。扫描页会保留候选状态，不伪造原文。</p>
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
              <div key={course.id}>
              <button className="home-course-card" onClick={() => navigate(`/courses/${course.id}`)}>
                <span className={`home-course-symbol home-course-symbol-${index % 3}`}>{course.name.slice(0, 1)}</span>
                <span className="home-course-copy"><strong>{course.name}</strong><small>{materialCounts[course.id] ?? 0} 份资料 · {getLastVisited(course.id) ? `最近学习 ${new Date(getLastVisited(course.id)!).toLocaleDateString('zh-CN')}` : `创建于 ${new Date(course.created_at).toLocaleDateString('zh-CN')}`}</small></span>
                <span className="home-course-arrow" aria-hidden="true">→</span>
              </button>
                <button className="text-button" onClick={() => void deleteCourse(course.id)}>移除课程</button>
                <button className="text-button" disabled={backupBusy === course.id} onClick={() => void (async () => { try { setBackupBusy(course.id); setBackupMessage(undefined); const record = await api.exportBackup(course.id); setBackupMessage(record.status === 'completed' ? `备份已生成：${record.path}` : record.error_message ?? '备份失败') } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : '备份失败') } finally { setBackupBusy(undefined) } })()}>{backupBusy === course.id ? '正在备份…' : '导出本课程备份'}</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="home-empty-state">
            <span className="empty-state-mark">＋</span>
            <div><strong>还没有课程</strong><p>新建一门课程，把相关课件、笔记和知识点集中整理。</p></div>
          </div>
        )}
        {courseActionError && <p className="form-error" role="alert">{courseActionError}</p>}
        {backupMessage && <p className="form-success" role="status">{backupMessage}</p>}
        {deletedCourses.length > 0 && <section aria-label="可恢复课程"><h3>可恢复的课程</h3>{deletedCourses.map((course) => <div key={course.id}><span>{course.name}</span><button className="text-button" onClick={() => void restoreCourse(course.id)}>恢复课程</button></div>)}</section>}

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

      {attentionMaterials.length > 0 && <section className="home-attention-section" aria-label="需要关注的资料"><div className="section-heading-row"><div><span className="eyebrow">课程处理提醒</span><h2>需要关注</h2></div></div><div className="home-attention-list">{attentionMaterials.map((material) => {
        const course = courses.find((item) => item.id === material.course_id)
        return <button className={`home-attention-item home-attention-${material.status}`} key={material.id} onClick={() => navigate(`/courses/${material.course_id}/materials`)}><span className="home-attention-mark">{material.status === 'failed' ? '!' : '·'}</span><span><strong>{course?.name} · {material.lecture_title}</strong><small>{material.status === 'failed' ? '解析失败，打开资料查看错误并重试。' : material.status === 'pending' ? '资料等待处理。' : '资料正在解析。'}</small></span><span aria-hidden="true">→</span></button>
      })}</div></section>}

      {requestedFeature && (
        <CourseGate feature={requestedFeature} onClose={() => setRequestedFeature(undefined)} />
      )}
    </div>
  )
}

function getLastVisited(courseId: string): string | null {
  try { return localStorage.getItem(`notebuddy.course.${courseId}.lastVisited`) } catch { return null }
}
