import type { EquipmentRecord, Issue, WorkRecord } from '../types'
import { decodeBytes } from '../lib/csv'
import { parseAnyCsv } from '../lib/records'
import IssueList from './IssueList'

interface Props {
  records: WorkRecord[]
  setRecords: (r: WorkRecord[]) => void
  equipment: EquipmentRecord[]
  setEquipment: (e: EquipmentRecord[]) => void
  issues: Issue[]
  setIssues: (i: Issue[]) => void
}

export default function ImportView({ records, setRecords, equipment, setEquipment, issues, setIssues }: Props) {
  async function onFiles(files: File[]) {
    if (files.length === 0) return
    let allRecords = records
    let allEquipment = equipment
    const newIssues: Issue[] = []
    for (const file of files) {
      const text = decodeBytes(new Uint8Array(await file.arrayBuffer()))
      const result = parseAnyCsv(text, file.name, {
        recordIds: new Set(allRecords.map((r) => r.id)),
        equipmentIds: new Set(allEquipment.map((e) => e.id)),
      })
      allRecords = [...allRecords, ...result.records]
      allEquipment = [...allEquipment, ...result.equipment]
      if (result.kind) {
        const count = result.kind === 'records' ? result.records.length : result.equipment.length
        const label = result.kind === 'records' ? '実績' : '機材'
        newIssues.push({ level: 'info', message: `${file.name}: ${label} ${count} 件を取り込みました` })
      }
      newIssues.push(...result.issues)
    }
    setRecords(allRecords)
    setEquipment(allEquipment)
    setIssues(newIssues)
  }

  function clear() {
    if (!confirm('取り込んだ実績・機材をすべて消します。よろしいですか?')) return
    setRecords([])
    setEquipment([])
    setIssues([])
  }

  const byClient = new Map<string, { name: string; count: number; equipment: number; from: string; to: string }>()
  const touch = (clientId: string, date: string, name = '') => {
    const s = byClient.get(clientId) ?? { name, count: 0, equipment: 0, from: date, to: date }
    if (!s.name) s.name = name
    if (date < s.from) s.from = date
    if (date > s.to) s.to = date
    byClient.set(clientId, s)
    return s
  }
  for (const r of records) touch(r.clientId, r.date, r.clientName).count++
  for (const e of equipment) touch(e.clientId, e.date).equipment++

  return (
    <section>
      <h2>SHIRUBEのCSVを取り込む</h2>
      <p className="hint">
        実績明細CSVと機材明細CSVを、まとめて選べます(種類は自動で判別します)。
        20日締めなど月をまたぐ元請けは、2か月分を取り込んでください。UTF-8・Shift_JIS のどちらでも読めます。
        データはこのブラウザの中だけで処理され、外部には送られません。
      </p>
      <div className="toolbar">
        <label className="button primary">
          CSVファイルを選ぶ
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            hidden
            onChange={(e) => {
              // value を空にすると FileList も空になるので、先に配列へ写す
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              void onFiles(files)
            }}
          />
        </label>
        {records.length + equipment.length > 0 && <button onClick={clear}>取り込んだデータを消す</button>}
      </div>
      <IssueList issues={issues} />

      <h3>取り込み済み: 実績 {records.length} 件 / 機材 {equipment.length} 件</h3>
      {byClient.size > 0 && (
        <table className="grid">
          <thead>
            <tr><th>元請けID</th><th>元請け名</th><th>実績</th><th>機材</th><th>勤務日の範囲</th></tr>
          </thead>
          <tbody>
            {[...byClient.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, s]) => (
              <tr key={id}>
                <td>{id}</td><td>{s.name}</td><td className="num">{s.count}</td><td className="num">{s.equipment}</td>
                <td>{s.from} 〜 {s.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
