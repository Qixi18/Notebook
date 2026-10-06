import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../components/AppLayout'

const statusLabels: Record<string, string> = {
  pending: '等待解析',
  processing: '解析中',
  completed: '已完成',
  failed: '解析失败',
}

export function MaterialsPage() {
  const {
    course,
    materials,
    selectedMaterialId,
    setSelectedMaterialId,
    pages,
    selectedPageNumber,
    setSelectedPageNumber,
    job,
    busy,
    uploadMaterial,
  } = useWorkspace()
  const [file, setFile] = useState<File>()
  const [lectureTitle, setLectureTitle] = useState('第 1 讲')

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    await uploadMaterial(file, lectureTitle)
    setFile(undefined)
  }

  const selectedPage = pages.find((page) => page.page_number === selectedPageNumber)

  return (
    <div className="feature-page page-enter">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>课程资料</h1><p>上传 PPTX 课件，检查解析状态与逐页内容。</p></div>
        <span className="page-count-pill">{materials.length} 份资料</span>
      </header>

      <form className="material-upload-card" onSubmit={(event) => void handleUpload(event)}>
        <div className="upload-card-heading"><span className="upload-card-icon">＋</span><div><h2>上传一份课程资料</h2><p>当前版本支持 PPTX，单文件上限 50 MB。</p></div></div>
        <div className="material-upload-fields">
          <label>讲次名称<input value={lectureTitle} onChange={(event) => setLectureTitle(event.target.value)} maxLength={200} placeholder="例如：第 1 讲 · 软件生命周期" /></label>
          <label className="material-file-field">选择课件<input type="file" accept=".pptx" onChange={(event) => setFile(event.target.files?.[0])} /></label>
          <button className="primary-button" type="submit" disabled={!file || busy}>{busy ? '上传中…' : '上传并解析'}</button>
        </div>
      </form>

      {job && job.status !== 'completed' && (
        <section className={`processing-card processing-${job.status}`} aria-live="polite">
          <div className="processing-card-heading"><strong>{statusLabels[job.status] ?? job.status}</strong><span>{job.progress}%</span></div>
          <div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div>
          <p>{job.error_message || (job.status === 'failed' ? '解析失败，请检查文件后重试。' : 'NoteBuddy 正在逐页解析这份 PPTX。')}</p>
        </section>
      )}

      <section className="materials-list-section">
        <div className="section-heading-row"><div><span className="eyebrow">当前课程</span><h2>已上传资料</h2></div></div>
        {materials.length === 0 ? (
          <div className="feature-empty-card"><span className="empty-state-mark">▱</span><h2>还没有课程资料</h2><p>选择 PPTX 上传后，解析状态和课件页面会显示在这里。</p></div>
        ) : (
          <div className="materials-browser">
            <div className="materials-list" aria-label="课程资料列表">
              {materials.map((material) => (
                <button className={`material-list-item ${selectedMaterialId === material.id ? 'material-list-item-active' : ''}`} key={material.id} onClick={() => setSelectedMaterialId(material.id)}>
                  <span className="material-list-icon">▱</span>
                  <span className="material-list-copy"><strong>{material.lecture_title}</strong><small>{material.original_filename} · {material.page_count} 页</small></span>
                  <span className={`status-pill status-pill-${material.status}`}>{statusLabels[material.status] ?? material.status}</span>
                </button>
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
                      <span><strong>{page.title || '未识别标题'}</strong><small>{page.raw_text ? `${page.raw_text.slice(0, 120)}${page.raw_text.length > 120 ? '…' : ''}` : '本页未识别到文本'}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {selectedPage && <article className="material-page-detail"><span className="eyebrow">第 {selectedPage.page_number} 页</span><h3>{selectedPage.title || '未识别标题'}</h3><p>{selectedPage.raw_text || '本页没有可展示的文本。'}</p>{selectedPage.warning && <small className="form-error">{selectedPage.warning}</small>}</article>}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
