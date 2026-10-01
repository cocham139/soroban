import type { Issue } from '../types'

const LABELS: Record<Issue['level'], string> = { error: 'エラー', warn: '注意', info: '完了' }

export default function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="issues no-print">
      {issues.map((issue, i) => (
        <li key={i} className={issue.level}>
          <span className="badge">{LABELS[issue.level]}</span>
          {issue.message}
        </li>
      ))}
    </ul>
  )
}
