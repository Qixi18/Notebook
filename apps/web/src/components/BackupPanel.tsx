import { useRef, useState, type ChangeEvent } from 'react'

import { api } from '../api'
import type { BackupPreview, BackupRecord } from '../types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState<BackupPreview>()
  const [record, setRecord] = useState<BackupRecord>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    setFile(next)
    setPreview(undefined)
    setRecord(undefined)
    setError(undefined)
  }

  async function inspectBackup() {
    if (!file || busy) return
    try {
      setBusy(true)
      setError(undefined)
      setPreview(await api.previewBackup(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '备份预览失败')
      setPreview(undefined)
    } finally {
      setBusy(false)
    }
  }

  async function restoreBackup() {
    if (!file || !preview?.valid || busy) return
    try {
      setBusy(true)
      setError(undefined)
      setRecord(await api.restoreBackup(file, true))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '备份恢复失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="operations-panel" aria-labelledby="backup-panel-title">
      <div className="section-heading-row">
        <div><span className="eyebrow">数据安全</span><h2 id="backup-panel-title">备份检查与恢复</h2></div>
        <span className="section-hint">先预览，再确认</span>
      </div>
      <p className="operations-panel-copy">导入包会在隔离目录校验并恢复，不会覆盖当前课程数据。当前导出的备份包含 SQLite 快照和原始课件，不包含密钥。</p>
      <div className="backup-picker-row">
        <input ref={inputRef} className="visually-hidden-input" type="file" accept=".zip,.notebuddy" onChange={chooseFile} />
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>选择 .notebuddy.zip</button>
        <span className="backup-file-name">{file?.name ?? '尚未选择备份文件'}</span>
        <button className="primary-button" type="button" disabled={!file || busy} onClick={() => void inspectBackup()}>{busy ? '处理中…' : '检查备份'}</button>
      </div>
      {preview && <div className={`backup-preview-card ${preview.valid ? 'backup-preview-valid' : 'backup-preview-invalid'}`}>
        <div className="backup-preview-header"><strong>{preview.valid ? '备份校验通过' : '备份无法导入'}</strong><span>{preview.format ? `格式 v${preview.format}` : '格式未知'}</span></div>
        <div className="backup-preview-stats"><span>{preview.course_count} 门课程</span><span>{preview.material_count} 份资料</span><span>{preview.original_count} 个原文件</span><span>{formatBytes(preview.total_bytes)}</span></div>
        {preview.conflicts.length > 0 && <div className="backup-preview-list"><strong>当前数据可能冲突</strong><ul>{preview.conflicts.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        {preview.errors.length > 0 && <div className="backup-preview-list backup-preview-errors"><strong>校验错误</strong><ul>{preview.errors.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        {preview.valid && <button className="primary-button" type="button" disabled={busy} onClick={() => void restoreBackup()}>{busy ? '恢复中…' : '确认恢复到隔离目录'}</button>}
      </div>}
      {record && <p className="form-success" role="status">恢复校验完成：{record.status}。当前数据未被覆盖。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
