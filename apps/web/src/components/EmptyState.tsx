import type { ReactNode } from 'react'

export function EmptyState({
  icon = '✦',
  title,
  description,
  action,
  compact = false,
}: {
  icon?: string
  title: string
  description: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <section className={`feature-empty-card${compact ? ' feature-empty-card-compact' : ''}`}>
      <span className="empty-state-mark" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </section>
  )
}
