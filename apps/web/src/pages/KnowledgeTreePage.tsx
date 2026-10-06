import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api'
import { EmptyState } from '../components/EmptyState'
import { featurePath, useWorkspace } from '../components/AppLayout'
import { SourceCard } from '../components/SourceCard'
import type { NoteSourceRef } from '../types'

export function KnowledgeTreePage() {
  const { courseId = '' } = useParams()
  const { course, courseContentLoading, graph, notes, materials, setSelectedMaterialId, setSelectedPageNumber, setSelectedNoteId } = useWorkspace()
  const [query, setQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [sources, setSources] = useState<NoteSourceRef[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesError, setSourcesError] = useState(false)
  const navigate = useNavigate()

  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return graph.nodes
    return graph.nodes.filter((node) => `${node.name} ${node.summary ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [graph.nodes, query])
  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId) ?? visibleNodes[0]
  const selectedNote = selectedNode && notes.find((item) => item.knowledge_node_id === selectedNode.id)
  const relatedEdges = selectedNode ? graph.edges.filter((edge) => edge.source_node_id === selectedNode.id || edge.target_node_id === selectedNode.id) : []

  useEffect(() => {
    setSelectedNodeId((current) => current && graph.nodes.some((node) => node.id === current) ? current : graph.nodes[0]?.id)
  }, [graph.nodes])

  useEffect(() => {
    setSources([])
    setSourcesError(false)
    if (!selectedNote) return
    let active = true
    setSourcesLoading(true)
    void api.getNoteSources(selectedNote.id).then((items) => { if (active) setSources(items) })
      .catch(() => { if (active) { setSources([]); setSourcesError(true) } })
      .finally(() => { if (active) setSourcesLoading(false) })
    return () => { active = false }
  }, [selectedNote?.id])

  function openNodeNote() {
    if (!selectedNote) return
    setSelectedNoteId(selectedNote.id)
    navigate(featurePath(courseId, 'notes'))
  }

  function openSource(source: NoteSourceRef) {
    setSelectedMaterialId(source.material_id)
    setSelectedPageNumber(source.page_number)
    navigate(featurePath(courseId, 'materials'))
  }

  return (
    <div className="feature-page page-enter">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>课程知识树</h1><p>按当前课程已整理出的知识点与关系浏览。</p></div>
        <span className="page-count-pill">{graph.nodes.length} 个节点 · {graph.edges.length} 条关系</span>
      </header>

      {courseContentLoading ? <div className="page-loading" role="status">正在读取知识图谱…</div> : graph.nodes.length === 0 ? (
        <EmptyState icon="⌘" title="知识树还在等待第一批知识点" description="上传并解析课程资料后，提取出的知识点会显示在这里。" action={<Link className="secondary-button link-button" to={featurePath(courseId, 'materials')}>前往课程资料</Link>} />
      ) : (
        <section className="knowledge-tree-layout">
          <div className="knowledge-canvas-panel">
            <div className="knowledge-canvas-toolbar">
              <div><strong>知识点</strong><small>选择节点查看笔记、来源与关系</small></div>
              <label className="node-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识点" aria-label="搜索知识点" />{query && <button type="button" className="clear-search-button" onClick={() => setQuery('')} aria-label="清除搜索">×</button>}</label>
            </div>

            {visibleNodes.length === 0 ? <div className="inline-empty" role="status">没有找到匹配的知识点，请更换搜索词或清除筛选。</div> : (
              <div className="knowledge-node-list" role="list" aria-label="知识点列表">
                {visibleNodes.map((node, index) => {
                  const connectedCount = graph.edges.filter((edge) => edge.source_node_id === node.id || edge.target_node_id === node.id).length
                  return (
                    <article className={`knowledge-node-row ${selectedNode?.id === node.id ? 'knowledge-node-row-active' : ''}`} key={node.id} role="listitem">
                      <button className="node-select-button" onClick={() => setSelectedNodeId(node.id)} aria-pressed={selectedNode?.id === node.id}>
                        <span className={`node-index node-index-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span>
                        <span className="knowledge-node-copy"><strong>{node.name}</strong><span>{node.summary || '当前没有摘要。'}</span><small>{connectedCount} 条关联 · {node.status}</small></span>
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          <aside className="knowledge-relation-panel" aria-label="所选知识点详情">
            {selectedNode ? <>
              <span className="eyebrow">节点详情</span>
              <h2>{selectedNode.name}</h2>
              <p className="node-detail-summary">{selectedNode.summary || '这个知识点暂时没有摘要。'}</p>
              <div className="node-detail-actions">
                {selectedNote && <button className="secondary-button" onClick={openNodeNote}>打开关联笔记</button>}
                {materials[0] && <Link className="text-button" to={featurePath(courseId, 'materials')}>浏览课程资料</Link>}
              </div>
              <div className="node-detail-section"><strong>关联知识点</strong>
                {relatedEdges.length ? <div className="relation-list">{relatedEdges.map((edge) => {
                  const otherId = edge.source_node_id === selectedNode.id ? edge.target_node_id : edge.source_node_id
                  const otherNode = graph.nodes.find((node) => node.id === otherId)
                  return <button className="relation-row relation-row-button" key={edge.id} onClick={() => setSelectedNodeId(otherId)}><strong>{otherNode?.name ?? '知识点'}</strong><span>{edge.relation_type}</span><span aria-hidden="true">→</span></button>
                })}</div> : <p className="muted-copy">目前没有已记录的关联。</p>}
              </div>
              {selectedNote && <div className="node-detail-section"><strong>笔记依据</strong>
                {sourcesLoading ? <p className="muted-copy" role="status">正在读取来源…</p> : sources.length ? <div className="source-card-list">{sources.map((source) => <SourceCard key={source.id} title={materials.find((item) => item.id === source.material_id)?.lecture_title ?? '课程资料'} pageNumber={source.page_number} quote={source.quote} onOpen={() => openSource(source)} />)}</div> : <p className={sourcesError ? 'evidence-error' : 'muted-copy'} role={sourcesError ? 'alert' : undefined}>{sourcesError ? '课件来源暂时无法读取。' : '没有可用的课件来源记录。'}</p>}
              </div>}
            </> : <p className="muted-copy">从列表中选择一个知识点，查看详细信息。</p>}
          </aside>
        </section>
      )}
    </div>
  )
}
