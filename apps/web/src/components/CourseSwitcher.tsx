import type { Course } from '../types'

export function CourseSwitcher({
  course,
  courses,
  loading,
  onSelect,
}: {
  course?: Course
  courses: Course[]
  loading: boolean
  onSelect: (courseId: string) => void
}) {
  return (
    <div className="sidebar-course-block">
      <div className="sidebar-section-label">当前课程</div>
      {course ? (
        <label className="course-switcher-label">
          <span className="course-dot" />
          <select className="course-switcher" aria-label="切换当前课程" value={course.id} onChange={(event) => onSelect(event.target.value)}>
            {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : <div className="current-course-empty" aria-live="polite">{loading ? '正在读取课程…' : courses.length ? '请选择一门课程' : '先创建一门课程'}</div>}
    </div>
  )
}
