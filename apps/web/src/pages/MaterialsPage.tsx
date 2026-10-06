import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { EmptyState } from '../components/EmptyState'
import { ProcessingStatus } from '../components/ProcessingStatus'
import { useWorkspace } from '../components/AppLayout'

const statusLabels: Record<string, string> = { pending: '等待处理', processing: '解析中', completed: '已完成', failed: '解析失败' }

export function MaterialsPage() {
  const {
    course,
    courseContentLoading,
    materials,
    selectedMaterialId,
    setSelectedMaterialId,
    pages,
    selectedPageNumber,
    setSelectedPageNumber,
    job,
    busy,
    uploadMaterial,
    retryMaterial,
    refreshCurrentMaterials,
  } = useWorkspace()
  const [file, setFile] = useState<File>()
  const [lectureTitle, setLectureTitle] = useState('第 1 讲')
  const [topicTitle, setTopicTitle] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [webSources, setWebSources] = useState<import('../types').WebSource[]>([])
  const [deletedMaterials, setDeletedMaterials] = useState<import('../types').Material[]>([])
  const [materialActionError, setMaterialActionError] = useState<string>()

  useEffect(() => {
    let active = true
    if (!course) return () => { active = false }
    void api.listDeletedMaterials(course.id).then((items) => { if (active) setDeletedMaterials(items) }).catch(() => { if (active) setDeletedMaterials([]) })
    return () => { active = false }
  }, [course?.id, materials])

  async function deleteMaterial(id: string) {
    try {
      const impact = await api.previewMaterialDeletion(id)
      if (impact.active_jobs) throw new Error('资料仍在处理中，请完成后再移除。')
      if (!window.confirm(`移除这份资料？将隐藏 ${impact.pages} 个页面和 ${impact.source_refs} 条来源；${impact.user_notes_protected} 条用户笔记受保护。操作前会备份，之后可恢复。`)) return
      await api.deleteMaterial(id)
      await refreshCurrentMaterials()
      setMaterialActionError(undefined)
    } catch (cause) { setMaterialActionError(cause instanceof Error ? cause.message : '资料移除失败') }
  }

  async function restoreMaterial(id: string) {
    try { await api.restoreMaterial(id); await refreshCurrentMaterials(); setMaterialActionError(undefined) }
    catch (cause) { setMaterialActionError(cause instanceof Error ? cause.message : '资料恢复失败') }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    try {
      await uploadMaterial(file, lectureTitle, topicTitle, allowDuplicate)
      setFile(undefined)
      setAllowDuplicate(false)
    } catch {
      // The workspace displays the API error; keep the file for a corrected retry.
    }
  }

  const selectedPage = pages.find((page) => page.page_number === selectedPageNumber)

  useEffect(() => {
    if (!selectedMaterialId) { setWebSources([]); return }
    let active = true
    void api.listMaterialWebSources(selectedMaterialId).then((items) => { if (active) setWebSources(items) }).catch(() => { if (active) setWebSources([]) })
    return () => { active = false }
  }, [selectedMaterialId])

  return (
    <div className="feature-page page-enter">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>课程资料</h1><p>上传 PPTX 课件，检查解析状态与逐页内容。</p></div>
        <span className="page-count-pill">{materials.length} 份资料</span>
      </header>

      <form className="material-upload-card" onSubmit={(event) => void handleUpload(event)}>
        <div className="upload-card-heading"><span className="upload-card-icon">＋</span><div><h2>上传一份课程资料</h2><p>支持 PPTX、PDF、DOCX，单文件上限由后端配置提供。</p></div></div>
        <div className="material-upload-fields">
          <label>章节 / 主题（可选）<input value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} maxLength={200} placeholder="例如：第一章 · 软件生命周期" /></label>
          <label>讲次名称<input value={lectureTitle} onChange={(event) => setLectureTitle(event.target.value)} maxLength={200} placeholder="例如：第 1 讲 · 软件生命周期" /></label>
          <label className="material-file-field">选择课件<input type="file" accept=".pptx,.pdf,.docx" onChange={(event) => setFile(event.target.files?.[0])} /></label>
          <label><input type="checkbox" checked={allowDuplicate} onChange={(event) => setAllowDuplicate(event.target.checked)} />相同文件作为新讲次导入</label>
          <button className="primary-button" type="submit" disabled={!file || busy}>{busy ? '上传中…' : '上传并解析'}</button>
        </div>
      </form>

      <ProcessingStatus job={job?.material_id === selectedMaterialId ? job : undefined} material={materials.find((item) => item.id === selectedMaterialId)} />
      {materialActionError && <p className="form-error" role="alert">{materialActionError}</p>}
      {deletedMaterials.length > 0 && <section aria-label="可恢复资料"><h2>可恢复的资料</h2>{deletedMaterials.map((material) => <div key={material.id}><span>{material.lecture_title} · {material.original_filename}</span><button className="text-button" onClick={() => void restoreMaterial(material.id)}>恢复资料</button></div>)}</section>}

      <section className="materials-list-section">
        <div className="section-heading-row"><div><span className="eyebrow">当前课程</span><h2>已上传资料</h2></div></div>
        {courseContentLoading ? <div className="page-loading" role="status">正在读取课程资料…</div> : materials.length === 0 ? (
          <EmptyState icon="▱" title="还没有课程资料" description="选择 PPTX 上传后，解析状态和课件页面会显示在这里。" />
        ) : (
          <div className="materials-browser">
            <div className="materials-list" aria-label="课程资料列表">
              {materials.map((material) => (
                <div className="material-row" key={material.id}>
                  <button className={`material-list-item ${selectedMaterialId === material.id ? 'material-list-item-active' : ''}`} onClick={() => setSelectedMaterialId(material.id)}>
                    <span className="material-list-icon">▱</span>
                    <span className="material-list-copy"><strong>{material.lecture_title}</strong><small>{material.topic_title ? `${material.topic_title} · ` : ''}{material.original_filename} · {material.page_count} 页</small><time dateTime={material.created_at}>上传于 {new Date(material.created_at).toLocaleString('zh-CN')}</time></span>
                    <span className={`status-pill status-pill-${material.status}`}>{statusLabels[material.status] ?? material.status}</span>
                  </button>
                  {material.status === 'failed' && <button className="material-retry-action" onClick={() => void retryMaterial(material.id)}>重试解析</button>}
                  {(material.status === 'completed' || material.status === 'failed') && <button className="text-button" onClick={() => void deleteMaterial(material.id)}>移除资料</button>}
                </div>
              ))}
            </div>

            <div className="material-pages-panel">
              <div className="panel-heading"><strong>逐页解析预览</strong><span>{pages.length} 页</span></div>
              {!selectedMaterialId ? (
                <div className="inline-empty">选择一份资料查看解析页面。</div>
              ) : pages.length === 0 ? (
                <div className="inline-empty">资料解析完成后，页面文本会显示在这里。</div>
              ) : (
                <div className="material-page-list">
                  {pages.map((page) => (
                    <button className={`material-page-item ${selectedPageNumber === page.page_number ? 'material-page-item-active' : ''}`} key={page.id} onClick={() => setSelectedPageNumber(page.page_number)}>
                      <span className="page-number-badge">{String(page.page_number).padStart(2, '0')}</span>
                      <span><strong>{page.location_label || `第 ${page.page_number} 页`} · {page.title || '未识别标题'}</strong><small>{page.raw_text ? `${page.raw_text.slice(0, 120)}${page.raw_text.length > 120 ? '…' : ''}` : page.warning || '本位置未识别到文本'}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {selectedPage && <article className="material-page-detail"><span className="eyebrow">{selectedPage.location_label || `第 ${selectedPage.page_number} 页`} · {selectedPage.extraction_method}</span><h3>{selectedPage.title || '未识别标题'}</h3><p>{selectedPage.raw_text || '本位置没有可展示的文本。'}</p>{selectedPage.warning && <small className="form-error">{selectedPage.warning}</small>}</article>}
              {selectedMaterialId && <section className="material-web-sources"><div className="panel-heading"><strong>联网补充来源</strong><span>{webSources.length}</span></div>{webSources.length ? <div className="source-card-list">{webSources.map((source) => <a className="source-card" key={source.id} href={source.url} target="_blank" rel="noreferrer"><span className="source-card-icon">↗</span><span className="source-card-body"><small className="source-card-meta">{source.site_name} · 检索于 {new Date(source.retrieved_at).toLocaleDateString('zh-CN')}</small><strong>{source.title}</strong><small>{source.snippet}</small></span></a>)}</div> : <p className="evidence-empty">此资料没有已保存的联网补充来源。搜索未配置或未找到可靠结果时不会显示虚构来源。</p>}</section>}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
