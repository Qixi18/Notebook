export function SourceCard({
  title,
  pageNumber,
  locationLabel,
  quote,
  sourceLabel = '课程课件',
  onOpen,
}: {
  title: string
  pageNumber: number
  locationLabel?: string | null
  quote: string
  sourceLabel?: string
  onOpen?: () => void
}) {
  const content = (
    <>
      <span className="source-card-icon" aria-hidden="true">↗</span>
      <span className="source-card-body">
        <span className="source-card-meta">{sourceLabel} · {locationLabel || `第 ${pageNumber} 页`}</span>
        <strong>{title}</strong>
        {quote && <small>{quote}</small>}
      </span>
      {onOpen && <span className="source-card-open" aria-hidden="true">查看</span>}
    </>
  )

  return onOpen ? (
    <button className="source-card" type="button" onClick={onOpen}>{content}</button>
  ) : (
    <article className="source-card">{content}</article>
  )
}
