import type { Job, Material } from '../types'

const labels: Record<string, string> = {
  pending: '等待处理',
  processing: '正在解析课件',
  completed: '解析完成',
  failed: '解析未完成',
}

export function ProcessingStatus({ job, material }: { job?: Job; material?: Material }) {
  const status = job?.status ?? material?.status
  if (!status) return null
  const failed = status === 'failed'
  const completed = status === 'completed'
  const progress = completed ? 100 : Math.max(0, Math.min(100, job?.progress ?? 0))

  return (
    <section className={`processing-card processing-${status}`} aria-live="polite" aria-atomic="true">
      <div className="processing-card-heading">
        <span className={`processing-status-mark processing-status-${status}`} aria-hidden="true">{completed ? '✓' : failed ? '!' : '·'}</span>
        <strong>{labels[status] ?? status}</strong>
        {!failed && <span className="processing-percent">{progress}%</span>}
      </div>
      {!failed && <div className="progress-track" role="progressbar" aria-label="课件解析进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
      <p>{failed ? job?.error_message || '解析过程中遇到问题。请确认文件可正常打开后重新上传。' : completed ? `${material?.page_count ?? 0} 页已完成解析，可以查看页面内容和课程整理结果。` : 'NoteBuddy 正在读取 PPTX 页面并整理其中的课程内容。'}</p>
    </section>
  )
}
