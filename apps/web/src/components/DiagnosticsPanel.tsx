import { useEffect, useState } from 'react'

import { api } from '../api'

type Diagnostics = {
  data_dir?: string
  database?: string
  originals_dir?: string
  providers?: Record<string, { status?: string; configured?: boolean }>
  limits?: { max_upload_bytes?: number; max_pages?: number; allowed_extensions?: string[] }
  security?: { bind_address?: string; secrets_in_response?: boolean; backup_excludes_env?: boolean }
}

function statusLabel(value: string | undefined): string {
  if (value === 'connected') return '已验证可用'
  if (value === 'configured_untested') return '已配置，尚未测试'
  if (value === 'disabled') return '未启用'
  if (value === 'missing_dependency') return '缺少本机依赖'
  return value ?? '未知'
}

export function DiagnosticsPanel() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function refresh() {
    try {
      setBusy(true)
      setError(undefined)
      setDiagnostics(await api.getDiagnostics() as Diagnostics)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取诊断信息失败')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  return (
    <section className="operations-panel diagnostics-panel" aria-labelledby="diagnostics-panel-title">
      <div className="section-heading-row">
        <div><span className="eyebrow">本机可观测性</span><h2 id="diagnostics-panel-title">配置诊断</h2></div>
        <button className="text-button" type="button" disabled={busy} onClick={() => void refresh()}>{busy ? '刷新中…' : '刷新诊断'}</button>
      </div>
      {diagnostics ? <>
        <div className="diagnostics-grid">
          {Object.entries(diagnostics.providers ?? {}).map(([name, provider]) => <div className="diagnostics-item" key={name}><strong>{name}</strong><span>{provider.configured ? '已配置' : '未配置'} · {statusLabel(provider.status)}</span></div>)}
        </div>
        <dl className="diagnostics-details">
          <div><dt>数据库</dt><dd>{diagnostics.database ?? '未返回'}</dd></div>
          <div><dt>原文件目录</dt><dd>{diagnostics.originals_dir ?? '未返回'}</dd></div>
          <div><dt>上传限制</dt><dd>{diagnostics.limits?.max_upload_bytes ? `${Math.round(diagnostics.limits.max_upload_bytes / (1024 * 1024))} MB` : '未返回'} · {diagnostics.limits?.max_pages ?? '—'} 页</dd></div>
          <div><dt>安全边界</dt><dd>{diagnostics.security?.bind_address ?? '未返回'} · 密钥不出响应/备份</dd></div>
        </dl>
      </> : <p className="muted-copy">正在读取本机诊断信息…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
