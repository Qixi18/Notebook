import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api'
import { EmptyState } from '../components/EmptyState'
import { featurePath, useWorkspace } from '../components/AppLayout'
import { SourceCard } from '../components/SourceCard'
import type { KnowledgeProposal, NoteSourceRef } from '../types'

export function KnowledgeTreePage() {
  const { courseId = '' } = useParams()
  const { course, courseContentLoading, graph, notes, materials, setSelectedMaterialId, setSelectedPageNumber, setSelectedNoteId } = useWorkspace()
  const [query, setQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [sources, setSources] = useState<NoteSourceRef[]>([])
  const [webSources, setWebSources] = useState<import('../types').WebSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesError, setSourcesError] = useState(false)
  const [view, setView] = useState<'tree' | 'relations'>('tree')
  const [lectureFilter, setLectureFilter] = useState('all')
  const [zoom, setZoom] = useState(1)
  const [proposals, setProposals] = useState<KnowledgeProposal[]>([])
  const [proposalError, setProposalError] = useState<string>()
  const navigate = useNavigate()

  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return graph.nodes.filter((node) => {
      const matchesQuery = !normalized || `${node.name} ${node.summary ?? ''}`.toLocaleLowerCase().includes(normalized)
      const matchesLecture = lectureFilter === 'all' || node.sources.some((source) => source.material_id === lectureFilter)
      return matchesQuery && matchesLecture
    })
  }, [graph.nodes, query, lectureFilter])
  const lectureOptions = useMemo(() => materials.map((material) => ({ id: material.id, title: material.lecture_title })), [materials])
  const topicGroups = useMemo(() => {
    const groups = new Map<string, { title: string; materialIds: string[] }>()
    for (const material of materials) {
      const title = material.topic_title?.trim() || material.lecture_title
      const group = groups.get(title) ?? { title, materialIds: [] }
      group.materialIds.push(material.id)
      groups.set(title, group)
    }
    return [...groups.entries()].map(([id, group]) => ({ id, ...group }))
  }, [materials])
  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId) ?? visibleNodes[0]
  const selectedNote = selectedNode && notes.find((item) => item.knowledge_node_id === selectedNode.id)
  const relatedEdges = selectedNode ? graph.edges.filter((edge) => edge.source_node_id === selectedNode.id || edge.target_node_id === selectedNode.id) : []
  const coreCutoff = 2

  useEffect(() => {
    setSelectedNodeId((current) => current && graph.nodes.some((node) => node.id === current) ? current : graph.nodes[0]?.id)
  }, [graph.nodes])

  useEffect(() => {
    setSources([])
    setWebSources([])
    setSourcesError(false)
    if (!selectedNote) return
    let active = true
    setSourcesLoading(true)
    void Promise.all([api.getNoteSources(selectedNote.id), api.getNoteWebSources(selectedNote.id)]).then(([items, webItems]) => { if (active) { setSources(items); setWebSources(webItems) } })
      .catch(() => { if (active) { setSources([]); setSourcesError(true) } })
      .finally(() => { if (active) setSourcesLoading(false) })
    return () => { active = false }
  }, [selectedNote?.id])

  useEffect(() => {
    if (!courseId) return
    void api.listKnowledgeProposals(courseId, 'pending').then(setProposals).catch(() => setProposalError('待确认知识整合读取失败'))
  }, [courseId, graph.nodes.length])

  async function reviewProposal(proposalId: string, decision: 'confirm' | 'reject') {
    try {
      await api.reviewKnowledgeProposal(proposalId, decision)
      setProposals((items) => items.filter((item) => item.id !== proposalId))
    } catch { setProposalError('知识整合提案处理失败') }
  }

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
        <span className="page-count-pill">{graph.nodes.length} 个节点 · {graph.edges.length} 条关系 · {proposals.length} 条待确认</span>
      </header>

      {courseContentLoading ? <div className="page-loading" role="status">正在读取知识图谱…</div> : graph.nodes.length === 0 ? (
        <EmptyState icon="⌘" title="知识树还在等待第一批知识点" description="上传并解析课程资料后，提取出的知识点会显示在这里。" action={<Link className="secondary-button link-button" to={featurePath(courseId, 'materials')}>前往课程资料</Link>} />
      ) : (
        <section className="knowledge-tree-layout">
          <div className="knowledge-canvas-panel">
            <div className="knowledge-canvas-toolbar">
              <div><strong>知识结构</strong><small>按课程资料讲次组织知识点；关系视图呈现已记录关联</small></div>
              <div className="tree-toolbar-controls">
                <label className="node-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识点" aria-label="搜索知识点" />{query && <button type="button" className="clear-search-button" onClick={() => setQuery('')} aria-label="清除搜索">×</button>}</label>
                <label className="tree-filter-label">讲次<select value={lectureFilter} onChange={(event) => setLectureFilter(event.target.value)}><option value="all">全部讲次</option>{lectureOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <div className="tree-view-switch" role="group" aria-label="知识结构视图"><button className={view === 'tree' ? 'active' : ''} onClick={() => setView('tree')}>分层树</button><button className={view === 'relations' ? 'active' : ''} onClick={() => setView('relations')}>关联列表</button></div>
              </div>
            </div>

            <div className="tree-legend" aria-label="知识树图例"><span><i className="legend-course" />课程</span><span><i className="legend-lecture" />课程讲次</span><span><i className="legend-point" />知识点</span><span><i className="legend-current" />当前选中</span><span><i className="legend-core" />关联较多</span><span><i className="legend-support" />关联较少</span><span title="依据当前图中的关系数量启发式区分，不代表人工审核过的知识重要性。">分类按关系数量估算</span></div>

            {visibleNodes.length === 0 ? <div className="inline-empty" role="status">没有找到匹配的知识点，请更换搜索词或清除筛选。</div> : (
              <>
              {view === 'relations' && <RelationshipGraph nodes={visibleNodes} edges={graph.edges.filter((edge) => visibleNodes.some((node) => node.id === edge.source_node_id) && visibleNodes.some((node) => node.id === edge.target_node_id))} selectedNodeId={selectedNode?.id} onSelect={setSelectedNodeId} />}
              <div className={`knowledge-node-list ${view === 'relations' ? 'knowledge-node-list-relations' : 'knowledge-node-list-tree'}`} role={view === 'tree' ? 'tree' : 'list'} aria-label="课程知识结构" style={{ '--tree-zoom': zoom } as React.CSSProperties}>
                {view === 'tree' && <div className="tree-root" role="treeitem" aria-level={1}><span className="tree-root-icon">⌂</span><strong>{course?.name ?? '当前课程'}</strong><small>{visibleNodes.length} 个知识点</small></div>}
                {view === 'tree' ? topicGroups.map((topic) => {
                  const lectureNodes = visibleNodes.filter((node) => node.sources.some((source) => topic.materialIds.includes(source.material_id)))
                  if (!lectureNodes.length) return null
                  return <section className="tree-lecture-group" role="group" key={topic.id}>
                    <div className="tree-lecture" role="treeitem" aria-level={2}><span className="tree-branch-line" /><span className="tree-lecture-icon">▱</span><strong>{topic.title}</strong><small>{topic.materialIds.length} 个讲次 · {lectureNodes.length} 个知识点</small></div>
                    <div className="tree-node-children" role="group">{lectureNodes.map((node, index) => <TreeNode key={node.id} node={node} index={index} active={selectedNode?.id === node.id} relationCount={graph.edges.filter((edge) => edge.source_node_id === node.id || edge.target_node_id === node.id).length} coreCutoff={coreCutoff} onSelect={() => setSelectedNodeId(node.id)} materials={materials} sourceMaterialIds={topic.materialIds} />)}</div>
                  </section>
                }) : visibleNodes.map((node, index) => {
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
                {view === 'tree' && visibleNodes.filter((node) => !node.sources.length || !node.sources.some((source) => materials.some((material) => material.id === source.material_id))).length > 0 && <section className="tree-lecture-group"><div className="tree-lecture"><span className="tree-branch-line" /><span className="tree-lecture-icon">?</span><strong>尚未关联讲次</strong></div><div className="tree-node-children">{visibleNodes.filter((node) => !node.sources.length || !node.sources.some((source) => materials.some((material) => material.id === source.material_id))).map((node, index) => <TreeNode key={node.id} node={node} index={index} active={selectedNode?.id === node.id} relationCount={graph.edges.filter((edge) => edge.source_node_id === node.id || edge.target_node_id === node.id).length} coreCutoff={coreCutoff} onSelect={() => setSelectedNodeId(node.id)} materials={materials} />)}</div></section>}
              </div>
              </>
            )}
            {view === 'tree' && <div className="tree-zoom-controls" aria-label="树形视图缩放"><button onClick={() => setZoom((value) => Math.max(.85, value - .1))} aria-label="缩小">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.2, value + .1))} aria-label="放大">＋</button><button onClick={() => setZoom(1)}>重置</button></div>}
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
              {selectedNote && <div className="node-detail-section"><strong>网络补充（与课件区分）</strong>{webSources.length ? <div className="source-card-list">{webSources.map((source) => <a className="source-card" key={source.id} href={source.url} target="_blank" rel="noreferrer"><span className="source-card-icon">↗</span><span className="source-card-body"><small className="source-card-meta">{source.site_name} · {new Date(source.retrieved_at).toLocaleDateString('zh-CN')}</small><strong>{source.title}</strong><small>{source.snippet}</small></span></a>)}</div> : <p className="muted-copy">没有保存的网络来源。</p>}</div>}
              <div className="node-detail-section"><strong>待确认整合</strong>{proposalError && <p className="evidence-error">{proposalError}</p>}{proposals.length ? proposals.slice(0, 4).map((proposal) => <article className="proposal-card" key={proposal.id}><strong>{proposal.candidate_name}</strong><small>{proposal.kind} · 置信度 {Math.round(proposal.confidence * 100)}%</small><p>{proposal.rationale}</p><div><button className="secondary-button" onClick={() => void reviewProposal(proposal.id, 'confirm')}>确认合并</button><button className="text-button" onClick={() => void reviewProposal(proposal.id, 'reject')}>拒绝</button></div></article>) : <p className="muted-copy">当前没有需要人工确认的跨讲整合。</p>}</div>
            </> : <p className="muted-copy">从列表中选择一个知识点，查看详细信息。</p>}
          </aside>
        </section>
      )}
    </div>
  )
}

function TreeNode({
  node, index, active, relationCount, coreCutoff, onSelect, materials, sourceMaterialIds,
}: {
  node: import('../types').KnowledgeNode
  index: number
  active: boolean
  relationCount: number
  coreCutoff: number
  onSelect: () => void
  materials: import('../types').Material[]
  sourceMaterialIds?: string[]
}) {
  const source = node.sources.find((item) => sourceMaterialIds?.includes(item.material_id)) ?? node.sources[0]
  return <button className={`tree-knowledge-node ${active ? 'tree-knowledge-node-active' : ''}`} role="treeitem" aria-level={3} aria-selected={active} onClick={onSelect}>
    <span className={`node-index node-index-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span>
    <span className="knowledge-node-copy"><strong>{node.name}</strong><span>{node.summary || '当前没有摘要。'}</span><small>{source ? `${materials.find((item) => item.id === source.material_id)?.lecture_title ?? '课程资料'} · 第 ${source.page_number} 页` : '来源待补充'}</small></span>
    <span className={`tree-importance tree-importance-${relationCount >= coreCutoff ? 'core' : 'support'}`} title={`按当前关系数量（${relationCount} 条）启发式标记，不代表人工审核后的重要性`}>{relationCount >= coreCutoff ? '关联较多' : '关联较少'}</span>
  </button>
}

function RelationshipGraph({
  nodes, edges, selectedNodeId, onSelect,
}: {
  nodes: import('../types').KnowledgeNode[]
  edges: import('../types').KnowledgeEdge[]
  selectedNodeId?: string
  onSelect: (nodeId: string) => void
}) {
  const columns = 3
  const positions = new Map(nodes.map((node, index) => [node.id, { x: 110 + (index % columns) * 205, y: 55 + Math.floor(index / columns) * 115 }]))
  const height = Math.max(160, Math.ceil(nodes.length / columns) * 115 + 25)
  return <div className="relationship-graph-panel"><div className="panel-heading"><strong>知识点关联图</strong><span>{edges.length} 条关系 · 下方提供可访问列表</span></div><div className="relationship-graph-scroll"><svg className="relationship-graph" viewBox={`0 0 640 ${height}`} role="img" aria-label={`知识关系图，${nodes.length} 个节点，${edges.length} 条关系`}>
    {edges.map((edge) => {
      const from = positions.get(edge.source_node_id)
      const to = positions.get(edge.target_node_id)
      if (!from || !to) return null
      return <g key={edge.id}><line className="relationship-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text className="relationship-edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 4}>{edge.relation_type}</text></g>
    })}
    {nodes.map((node) => {
      const point = positions.get(node.id)!
      return <g className={`relationship-node ${selectedNodeId === node.id ? 'relationship-node-active' : ''}`} key={node.id} role="button" aria-label={`${node.name}：${node.summary ?? '没有摘要'}`} aria-pressed={selectedNodeId === node.id} tabIndex={0} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id) } }}>
        <rect x={point.x - 82} y={point.y - 23} width="164" height="46" rx="12" /><text x={point.x} y={point.y + 4}>{node.name.length > 19 ? `${node.name.slice(0, 18)}…` : node.name}</text>
      </g>
    })}
  </svg></div></div>
}
