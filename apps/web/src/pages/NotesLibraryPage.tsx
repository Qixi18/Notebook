import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api'
import { featurePath, useWorkspace } from '../components/AppLayout'
import type { Course, Note } from '../types'

type NoteEntry = { note: Note; course: Course }

export function NotesLibraryPage() {
  const { courses, coursesLoading } = useWorkspace()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState<'all' | 'recent' | 'edited'>('all')

  useEffect(() => {
    let active = true
    if (!courses.length) {
      setEntries([])
      setLoading(coursesLoading)
      setLoadError(undefined)
      return () => { active = false }
    }
    setLoading(true)
    setLoadError(undefined)
    void Promise.all(courses.map(async (course) => (await api.listNotes(course.id)).map((note) => ({ note, course }))))
      .then((collections) => {
        if (active) setEntries(collections.flat())
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : '笔记列表读取失败')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courses, coursesLoading])

  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return entries.filter(({ note, course }) => {
      const matchesCourse = courseFilter === 'all' || course.id === courseFilter
      const matchesQuery = !normalized || `${note.title} ${course.name} ${note.content_markdown}`.toLocaleLowerCase().includes(normalized)
      const matchesSort = sortFilter !== 'edited' || note.user_locked || note.content_origin === 'user'
      return matchesCourse && matchesQuery && matchesSort
    }).sort((left, right) => sortFilter === 'recent' ? right.note.updated_at.localeCompare(left.note.updated_at) : right.note.created_at.localeCompare(left.note.created_at))
  }, [entries, query, courseFilter, sortFilter])

  function openNote(entry: NoteEntry) {
    navigate(`/courses/${entry.course.id}/notes/${entry.note.id}`)
  }

  function createFromMaterials() {
    const course = courses.find((item) => item.id === courseFilter) ?? courses[0]
    if (course) navigate(featurePath(course.id, 'materials'))
    else navigate('/')
  }

  return (
    <section className="notes-library page-enter" aria-labelledby="notes-library-title">
      <header className="notes-library-heading">
        <div>
          <h1 id="notes-library-title">笔记</h1>
          <p>把每一份学习整理，收进自己的书架。</p>
        </div>
      </header>

      <div className="notes-library-filters">
        <label className="notes-library-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记…" aria-label="搜索笔记" />
        </label>
        <label className="notes-library-select">
          <span aria-hidden="true">◇</span>
          <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} aria-label="按课程筛选">
            <option value="all">全部课程</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
        </label>
        <label className="notes-library-select notes-sort-select">
          <span aria-hidden="true">☰</span>
          <select value={sortFilter} onChange={(event) => setSortFilter(event.target.value as typeof sortFilter)} aria-label="笔记筛选">
            <option value="all">全部笔记</option>
            <option value="recent">最近更新</option>
            <option value="edited">我的编辑</option>
          </select>
        </label>
      </div>

      {loadError && <p className="notes-library-error" role="alert">{loadError}</p>}
      {loading ? <p className="notes-library-state" role="status">正在整理你的笔记…</p> : visibleNotes.length ? (
        <>
          <div className="notes-bookshelf" aria-label="所有笔记">
            <button className="book-create-tile" type="button" onClick={createFromMaterials}>
              <span aria-hidden="true">＋</span><strong>新建笔记</strong><small>从课程资料开始整理</small>
            </button>
            {visibleNotes.map(({ note, course }, index) => (
              <button className={`note-book note-book-${index % 3}`} key={note.id} type="button" onClick={() => openNote({ note, course })} aria-label={`打开笔记：${note.title}，课程：${course.name}`}>
                <span className="note-book-spine" aria-hidden="true" />
                <span className="note-book-menu" aria-hidden="true">···</span>
                <span className="note-book-content">
                  <strong>{note.title}</strong>
                  <span className="note-book-rule" aria-hidden="true" />
                  <span className="note-book-course">{course.name}</span>
                  <small>{note.user_locked ? '我的编辑' : '课程笔记'} · {new Date(note.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 更新</small>
                </span>
                <span className="note-book-motif" aria-hidden="true">{index % 3 === 0 ? '⌁' : index % 3 === 1 ? '✳' : '♧'}</span>
              </button>
            ))}
          </div>
          <p className="notes-library-count">共 {visibleNotes.length} 条笔记</p>
        </>
      ) : (
        <div className="notes-library-empty">
          <span aria-hidden="true">▤</span>
          <strong>{query || courseFilter !== 'all' || sortFilter === 'edited' ? '没有找到匹配的笔记' : coursesLoading ? '正在读取课程…' : '还没有课程笔记'}</strong>
          <p>{query || courseFilter !== 'all' || sortFilter === 'edited' ? '试试更换搜索词或筛选条件。' : '上传并解析课程资料后，整理好的学习笔记会出现在这里。'}</p>
          {!query && courseFilter === 'all' && sortFilter !== 'edited' && courses.length > 0 && <button type="button" className="notes-library-empty-action" onClick={createFromMaterials}>前往课程资料</button>}
          {!courses.length && !coursesLoading && <button type="button" className="notes-library-empty-action" onClick={() => navigate('/')}>创建课程</button>}
        </div>
      )}
    </section>
  )
}
