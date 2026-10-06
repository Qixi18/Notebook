import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { featurePath, useWorkspace } from '../components/AppLayout'

export function KnowledgeTreePage() {
  const { courseId = '' } = useParams()
  const { course, graph, notes, materials, setSelectedMaterialId, setSelectedNoteId } = useWorkspace()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return graph.nodes
    return graph.nodes.filter((node) => `${node.name} ${node.summary ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [graph.nodes, query])

  function openNodeNote(nodeId: string) {
    const note = notes.find((item) => item.knowledge_node_id === nodeId)
    if (!note) return
    setSelectedNoteId(note.id)
    navigate(featurePath(courseId, 'notes'))
  }

  return (
    <div className="feature-page page-enter">
      <header className="page-heading-block compact-heading">
        <div><span className="eyebrow">{course?.name ?? '当前课程'}</span><h1>课程知识树</h1><p>按当前课程已整理出的知识点与关系浏览。</p></div>
        <span className="page-count-pill">{graph.nodes.length} 个节点 · {graph.edges.length} 条关系</span>
      </header>

      <section className="knowledge-tree-layout">
        <div className="knowledge-canvas-panel">
          <div className="knowledge-canvas-toolbar">
            <div><strong>知识点</strong><small>选择一个节点查看关联笔记</small></div>
            <label className="node-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识点" aria-label="搜索知识点" />
            </label>
          </div>

          {graph.nodes.length === 0 ? (
            <div className="feature-empty-card tree-empty-card">
              <span className="empty-state-mark">⌘</span>
              <h2>知识树还在等待第一批知识点</h2>
              <p>上传并解析课程资料后，提取出的知识点会显示在这里。</p>
              <Link className="secondary-button link-button" to={featurePath(courseId, 'materials')}>前往课程资料</Link>
            </div>
          ) : visibleNodes.length === 0 ? (
            <div className="inline-empty">没有找到匹配的知识点。</div>
          ) : (
            <div className="knowledge-node-list" role="list" aria-label="知识点列表">
              {visibleNodes.map((node, index) => {
                const connectedEdges = graph.edges.filter((edge) => edge.source_node_id === node.id || edge.target_node_id === node.id)
                const linkedNote = notes.find((note) => note.knowledge_node_id === node.id)
                return (
                  <article className="knowledge-node-row" key={node.id} role="listitem">
                    <span className={`node-index node-index-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span>
                    <div className="knowledge-node-copy">
                      <strong>{node.name}</strong>
                      <p>{node.summary || '当前没有摘要。'}</p>
                      <small>{connectedEdges.length} 条关联 · {node.status}</small>
                    </div>
                    <div className="knowledge-node-actions">
                      {linkedNote && <button className="text-button" onClick={() => openNodeNote(node.id)}>打开笔记</button>}
                      {materials[0] && <button className="text-button" onClick={() => { setSelectedMaterialId(materials[0].id); navigate(featurePath(courseId, 'materials')) }}>查看课件</button>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <aside className="knowledge-relation-panel">
          <span className="eyebrow">关系概览</span>
          <h2>节点关联</h2>
          {graph.edges.length ? (
            <div className="relation-list">
              {graph.edges.map((edge) => {
                const source = graph.nodes.find((node) => node.id === edge.source_node_id)
                const target = graph.nodes.find((node) => node.id === edge.target_node_id)
                return <div className="relation-row" key={edge.id}><strong>{source?.name ?? '知识点'}</strong><span>{edge.relation_type}</span><strong>{target?.name ?? '知识点'}</strong></div>
              })}
            </div>
          ) : <p className="muted-copy">目前没有已记录的节点关系。</p>}
        </aside>
      </section>
    </div>
  )
}
