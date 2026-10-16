import { APP_VERSION, CHANGELOG } from '../version'

/** 更新履歴(画面左上の版の番号から開く) */
export default function ChangelogView() {
  return (
    <section className="changelog-view">
      <h2>更新履歴</h2>
      <p className="hint">現在のバージョン: ver {APP_VERSION}</p>
      {CHANGELOG.map((entry, i) => (
        <div key={entry.version} className="changelog-entry">
          <h3>
            ver {entry.version}
            {i === 0 && <span className="changelog-latest">最新</span>}
            {entry.date && <span className="changelog-date">{entry.date}</span>}
          </h3>
          <div className="changelog-title">{entry.title}</div>
          <ul>
            {entry.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
