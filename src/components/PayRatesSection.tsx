import type { Masters, PayRate, WorkRecord } from '../types'
import { affiliationOf } from '../lib/labor'
import { newPayRate } from '../lib/masters'

interface Props {
  masters: Masters
  setMasters: (m: Masters) => void
  records: WorkRecord[]
}

const toInt = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

/** マスタ: 支払単価(自社の労務費・協力業者の外注費) */
export default function PayRatesSection({ masters, setMasters, records }: Props) {
  const set = (id: string, patch: Partial<PayRate>) =>
    setMasters({ ...masters, payRates: masters.payRates.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const known = new Set(masters.payRates.map((r) => r.affiliation.trim()))
  const missing = [...new Set(records.map(affiliationOf))].filter((a) => !known.has(a))

  return (
    <>
      <h3>支払単価(労務費・外注費)</h3>
      <p className="hint">
        「4. 隊員・外注費」の金額の計算に使います。自社の隊員は給与の単価、協力業者は外注の単価です。
        隊員名・職種を空欄にすると、その所属の全員に使います(隊員名を入れた行が優先)。日給は勤務区分(日勤・夜勤)で単価を分けます。
      </p>
      {missing.length > 0 && (
        <p className="callout">
          取り込んだ実績に、支払単価が未登録の所属が {missing.length} 件あります({missing.join('、')})。
          <button onClick={() => setMasters({ ...masters, payRates: [...masters.payRates, ...missing.map((a) => newPayRate({ affiliation: a }))] })}>
            まとめて追加
          </button>
        </p>
      )}
      {masters.payRates.length > 0 && (
        <div className="scroll">
          <table className="grid edit">
            <thead>
              <tr><th>所属</th><th>隊員名</th><th>職種</th><th>方式</th><th>日勤</th><th>夜勤</th><th>残業</th><th></th></tr>
            </thead>
            <tbody>
              {masters.payRates.map((r) => {
                const unit = r.method === 'daily' ? '円/日' : '円/時間'
                return (
                  <tr key={r.id}>
                    <td><input className="s" value={r.affiliation} onChange={(e) => set(r.id, { affiliation: e.target.value })} /></td>
                    <td><input className="s" value={r.staffName} placeholder="(全員)" onChange={(e) => set(r.id, { staffName: e.target.value })} /></td>
                    <td><input className="s" value={r.jobType} placeholder="(全職種)" onChange={(e) => set(r.id, { jobType: e.target.value })} /></td>
                    <td>
                      <select value={r.method} onChange={(e) => set(r.id, { method: e.target.value as PayRate['method'] })}>
                        <option value="daily">日給(1日いくら)</option>
                        <option value="hourly">時給(1時間いくら)</option>
                      </select>
                    </td>
                    <td><input className="n" type="number" min={0} value={r.dayPrice} onChange={(e) => set(r.id, { dayPrice: toInt(e.target.value) })} /><span className="sub">{unit}</span></td>
                    <td><input className="n" type="number" min={0} value={r.nightPrice} onChange={(e) => set(r.id, { nightPrice: toInt(e.target.value) })} /><span className="sub">{unit}</span></td>
                    <td><input className="n" type="number" min={0} value={r.overtimeHourly} onChange={(e) => set(r.id, { overtimeHourly: toInt(e.target.value) })} /><span className="sub">円/時間</span></td>
                    <td>
                      <button className="danger" onClick={() => setMasters({ ...masters, payRates: masters.payRates.filter((x) => x.id !== r.id) })}>
                        削除
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={() => setMasters({ ...masters, payRates: [...masters.payRates, newPayRate()] })}>支払単価を追加</button>
    </>
  )
}
