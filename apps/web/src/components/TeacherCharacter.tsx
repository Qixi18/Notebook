export type TeacherStatus = 'idle' | 'thinking' | 'explaining' | 'error'

const statusLabels: Record<TeacherStatus, string> = {
  idle: 'AI 教师',
  thinking: '正在思考…',
  explaining: '正在讲解',
  error: '暂时遇到问题',
}

const statusAssets: Record<TeacherStatus, string> = {
  idle: '/assets/teacher/teacher-idle.png',
  thinking: '/assets/teacher/teacher-thinking.png',
  explaining: '/assets/teacher/teacher-explaining.png',
  error: '/assets/teacher/teacher-error.png',
}

export function TeacherCharacter({ status = 'idle', compact = false }: { status?: TeacherStatus; compact?: boolean }) {
  return (
    <div className={`teacher-character teacher-character-${status}${compact ? ' teacher-character-compact' : ''}`} role="img" aria-label={`NoteBuddy AI 精灵教师：${statusLabels[status]}`}>
      <div className="teacher-character-halo" aria-hidden="true" />
      <img className="teacher-character-image" src={statusAssets[status]} alt="" />
      <span className="teacher-character-label" aria-live="polite">{statusLabels[status]}</span>
    </div>
  )
}
