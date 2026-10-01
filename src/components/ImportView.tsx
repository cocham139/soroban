import type { Issue, WorkRecord } from '../types'
import { decodeBytes } from '../lib/csv'
import { parseWorkRecords } from '../lib/records'
import IssueList from './IssueList'

interface Props {
  records: WorkRecord[]
  setRecords: (r: WorkRecord[]) => void
  issues: Issue[]
  setIssues: (i: Issue[]) => void
}

export default function ImportView({ records, setRecords, issues, setIssues }: Props) {
  async function onFiles(files: File[]) {
    if (files.length === 0) return
    let all = records
    const newIssues: Issue[] = []
    for (const file of files) {
      const text = decodeBytes(new Uint8Array(await file.arrayBuffer()))
      const result = parseWorkRecords(text, file.name, new Set(all.map((r) => r.id)))
      all = [...all, ...result.records]
      newIssues.push(
        { level: 'info', message: `${file.name}: ${result.records.length} 件を取り込みました` },
        ...result.issues,
      )
    }
    setRecords(all)
    setIssues(newIssues)
  }

  function clear() {
    if (!confirm('取り込んだ実績をすべて消します。よろしいですか?')) return
    setRecords([])
    setIssues([])
  }

  const byClient = new Map<string, { name: string; count: number; from: string; to: string }>()
  for (const r of records) {
    const s = byClient.get(r.clientId) ?? { name: r.clientName, count: 0, from: r.date, to: r.date }
    s.count++
    if (r.date < s.from) s.from = r.date
    if (r.date > s.to) s.to = r.date
    byClient.set(r.clientId, s)
  }

  return (
    <section>
      <h2>SHIRUBEの実績明細CSVを取り込む</h2>
      <p className="hint">
        複数のファイルをまとめて選べます(20日締めなど月をまたぐ元請けは、2か月分を取り込んでください)。
        UTF-8・Shift_JIS のどちらでも読めます。データはこのブラウザの中だけで処理され、外部には送られません。
      </p>
      <div className="toolbar">
        <label className="button primary">
          CSVファイルを選ぶ
          <input type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => {
            // value を空にすると FileList も空になるので、先に配列へ写す
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void onFiles(files)
          }} />
        </label>
        {records.length > 0 && <button onClick={clear}>取り込んだ実績を消す</button>}
      </div>
      <IssueList issues={issues} />

      <h3>取り込み済み: {records.length} 件</h3>
      {records.length > 0 && (
        <table className="grid">
          <thead>
            <tr><th>元請けID</th><th>元請け名</th><th>件数</th><th>勤務日の範囲</th></tr>
          </thead>
          <tbody>
            {[...byClient.entries()].sort().map(([id, s]) => (
              <tr key={id}>
                <td>{id}</td><td>{s.name}</td><td className="num">{s.count}</td><td>{s.from} 〜 {s.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
