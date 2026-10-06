import type { Coverage } from '../types'

type Props = {
  coverage?: Coverage
  onOpenPage: (pageNumber: number) => void
}

export function CoverageGrid({ coverage, onOpenPage }: Props) {
  if (!coverage) return null
  return (
    <section className="coverage-panel" aria-label="资料来源覆盖">
      <div className="panel-heading"><strong>来源覆盖</strong><span>{coverage.cited_locations}/{coverage.total_locations} 个位置已引用</span></div>
      <div className="coverage-grid">
        {coverage.locations.map((location) => (
          <button
            className={`coverage-location coverage-location-${location.status}`}
            key={location.page_id}
            type="button"
            onClick={() => onOpenPage(location.page_number)}
            title={location.note_titles.length ? `关联笔记：${location.note_titles.join('、')}` : '尚未关联笔记'}
          >
            <strong>{location.location_label}</strong>
            <small>{location.status === 'cited' ? `${location.citation_count} 条引用` : '待检查'}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
