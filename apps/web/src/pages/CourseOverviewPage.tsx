import { Link, useParams } from 'react-router-dom'

import { featureDescriptions, featureLabels, featurePath, useWorkspace, type Feature } from '../components/AppLayout'

const features: Feature[] = ['notes', 'knowledge-tree', 'materials', 'assistant']

const materialStatus: Record<string, string> = {
  pending: '等待解析',
  processing: '解析中',
  completed: '已完成',
  failed: '解析失败',
}

export function CourseOverviewPage() {
  const { courseId = '' } = useParams()
  const { course, materials, notes, graph, coursesLoading, refreshCourses } = useWorkspace()

  if (coursesLoading) return <div className="page-loading">正在读取课程…</div>
  if (!course) {
    return (
      <section className="route-state-card" role="alert">
        <span className="route-state-symbol">?</span>
        <h1>找不到这门课程</h1>
        <p>课程可能已被移除，或链接中的课程编号无效。</p>
        <Link className="primary-button link-button" to="/">返回首页选择课程</Link>
        <button className="text-button" onClick={() => void refreshCourses()}>重新读取课程</button>
      </section>
    )
  }

  const latestMaterial = materials[0]

  return (
    <div className="course-overview page-enter">
      <header className="page-heading-block">
        <div>
          <span className="eyebrow">课程学习空间</span>
          <h1>{course.name}</h1>
          <p>{course.description || '这门课程的资料、笔记和知识结构都集中在这里。'}</p>
        </div>
        <Link className="primary-button link-button" to={featurePath(courseId, 'materials')}>＋ 上传课程资料</Link>
      </header>

      <section className="course-summary-grid" aria-label="课程概况">
        <article className="summary-card"><span>资料</span><strong>{materials.length}</strong><small>份课程资料</small></article>
        <article className="summary-card"><span>资料页数</span><strong>{materials.reduce((total, material) => total + material.page_count, 0)}</strong><small>课件页面</small></article>
        <article className="summary-card"><span>知识点</span><strong>{graph.nodes.length}</strong><small>个课程节点</small></article>
        <article className="summary-card"><span>笔记</span><strong>{notes.length}</strong><small>条可复习内容</small></article>
      </section>

      <section className="course-next-step">
        <div className="next-step-mark">{latestMaterial ? '✓' : '1'}</div>
        <div>
          <span className="eyebrow">接下来</span>
          <h2>{latestMaterial ? '继续整理这门课程' : '上传第一份课程资料'}</h2>
          <p>{latestMaterial ? `最近资料“${latestMaterial.lecture_title}”当前状态：${materialStatus[latestMaterial.status] ?? latestMaterial.status}。` : '先上传 PPTX 课件，NoteBuddy 会按当前支持的流程解析页面并整理知识点。'}</p>
        </div>
        <Link className="secondary-button link-button" to={featurePath(courseId, latestMaterial ? 'notes' : 'materials')}>
          {latestMaterial ? '打开笔记' : '前往课程资料'}
        </Link>
      </section>

      <section className="course-tools-section">
        <div className="section-heading-row">
          <div><span className="eyebrow">课程功能</span><h2>继续学习</h2></div>
        </div>
        <div className="course-tool-grid">
          {features.map((feature, index) => (
            <Link className="course-tool-card" key={feature} to={featurePath(courseId, feature)}>
              <span className={`course-tool-number course-tool-number-${index}`}>0{index + 1}</span>
              <span><strong>{featureLabels[feature]}</strong><small>{featureDescriptions[feature]}</small></span>
              <span className="course-tool-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
