import { useEffect, useId, useRef, type ReactNode } from 'react'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  eyebrow?: string
  tone?: 'primary' | 'danger'
  pending?: boolean
  pendingLabel?: string
  error?: string
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  eyebrow = '请确认操作',
  tone = 'primary',
  pending = false,
  pendingLabel = '处理中…',
  error,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef(onCancel)

  useEffect(() => { cancelRef.current = onCancel }, [onCancel])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) cancelRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [pending])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel()
    }}>
      <section className={`course-gate-modal confirm-dialog confirm-dialog-${tone}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <button className="modal-close" type="button" onClick={onCancel} disabled={pending} aria-label="关闭">×</button>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId} className="muted-copy">{description}</p>
        {children}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="confirm-dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={pending} autoFocus>{cancelLabel}</button>
          <button className={tone === 'danger' ? 'danger-button' : 'primary-button'} type="button" onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
