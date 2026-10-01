import type { ChangeEvent } from 'react'
import type { Client, Company, Masters, Rate, RoundingMode, WorkRecord } from '../types'
import { missingClients, missingRates, newClient, newRate, parseMasters } from '../lib/masters'
import { downloadText } from '../lib/export'
import { todayString } from '../lib/period'

interface Props {
  masters: Masters
  setMasters: (m: Masters) => void
  records: WorkRecord[]
}

const toInt = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

const DAY_OPTIONS: [number, string][] = [
  [0, '末日'],
  ...Array.from({ length: 28 }, (_, i) => [i + 1, `${i + 1}日`] as [number, string]),
]

export default function MastersView({ masters, setMasters, records }: Props) {
  const setCompany = (patch: Partial<Company>) => setMasters({ ...masters, company: { ...masters.company, ...patch } })
  const setClient = (i: number, patch: Partial<Client>) =>
    setMasters({ ...masters, clients: masters.clients.map((c, j) => (i === j ? { ...c, ...patch } : c)) })
  const setRate = (id: string, patch: Partial<Rate>) =>
    setMasters({ ...masters, rates: masters.rates.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const toAddClients = missingClients(records, masters)
  const toAddRates = missingRates(records, masters)
  const siteNames = new Map(records.map((r) => [`${r.clientId}\u0000${r.siteId}`, r.siteName]))

  async function importJson(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const next = parseMasters(await file.text())
      if (confirm(`${file.name} を読み込み、今のマスタを置き換えます。よろしいですか?`)) setMasters(next)
    } catch (err) {
      alert(`読み込めませんでした: ${(err as Error).message}`)
    }
  }

  const c = masters.company
  return (
    <section>
      <h2>マスタ</h2>
      <p className="hint">
        入力内容はこのブラウザに保存されます。ブラウザのデータが消えることもあるので、
        変更したら「マスタを書き出す」で共有フォルダにJSONファイルを保存してください(それが正本です)。
      </p>
      <div className="toolbar">
        <button
          className="primary"
          onClick={() =>
            downloadText(`soroban-masters_${todayString(new Date())}.json`, JSON.stringify(masters, null, 2), 'application/json')
          }
        >
          マスタを書き出す
        </button>
        <label className="button">
          マスタを読み込む
          <input type="file" accept=".json,application/json" hidden onChange={importJson} />
        </label>
      </div>

      <h3>自社情報</h3>
      <div className="form">
        <label>社名<input value={c.name} onChange={(e) => setCompany({ name: e.target.value })} /></label>
        <label>郵便番号<input value={c.postalCode} onChange={(e) => setCompany({ postalCode: e.target.value })} /></label>
        <label className="wide">住所<input value={c.address} onChange={(e) => setCompany({ address: e.target.value })} /></label>
        <label>電話<input value={c.tel} onChange={(e) => setCompany({ tel: e.target.value })} /></label>
        <label>
          登録番号(インボイス)
          <input value={c.registrationNo} placeholder="T1234567890123" onChange={(e) => setCompany({ registrationNo: e.target.value })} />
        </label>
        <label>
          消費税の端数処理
          <select value={c.taxRounding} onChange={(e) => setCompany({ taxRounding: e.target.value as RoundingMode })}>
            <option value="floor">切り捨て</option>
            <option value="round">四捨五入</option>
            <option value="ceil">切り上げ</option>
          </select>
        </label>
        <label className="wide">
          振込先
          <textarea rows={3} value={c.bankInfo} onChange={(e) => setCompany({ bankInfo: e.target.value })} />
        </label>
      </div>
      {c.registrationNo && !/^T\d{13}$/.test(c.registrationNo) && (
        <p className="warn-text">登録番号は「T + 13桁の数字」の形式です</p>
      )}

      <h3>元請け</h3>
      {toAddClients.length > 0 && (
        <p className="callout">
          取り込んだ実績に、未登録の元請けが {toAddClients.length} 件あります。
          <button onClick={() => setMasters({ ...masters, clients: [...masters.clients, ...toAddClients] })}>
            まとめて追加
          </button>
        </p>
      )}
      <div className="scroll">
        <table className="grid edit">
          <thead>
            <tr>
              <th>ID</th><th>正式名称</th><th>敬称</th><th>計算方式</th><th>人工の数え方</th>
              <th>所定実働(分)</th><th>締め日</th><th>支払</th><th>請求単位</th><th>経費</th><th></th>
            </tr>
          </thead>
          <tbody>
            {masters.clients.map((cl, i) => (
              <tr key={i}>
                <td><input className="s" value={cl.id} onChange={(e) => setClient(i, { id: e.target.value })} /></td>
                <td><input value={cl.name} onChange={(e) => setClient(i, { name: e.target.value })} /></td>
                <td><input className="s" value={cl.honorific} onChange={(e) => setClient(i, { honorific: e.target.value })} /></td>
                <td>
                  <select value={cl.billingMethod} onChange={(e) => setClient(i, { billingMethod: e.target.value as Client['billingMethod'] })}>
                    <option value="ninku">人工</option>
                    <option value="hourly">時間単価</option>
                  </select>
                </td>
                <td>
                  <select disabled={cl.billingMethod !== 'ninku'} value={cl.ninkuMode} onChange={(e) => setClient(i, { ninkuMode: e.target.value as Client['ninkuMode'] })}>
                    <option value="perDay">1日=1人工</option>
                    <option value="prorate">実働で按分</option>
                  </select>
                </td>
                <td>
                  <input className="n" type="number" min={1} disabled={cl.billingMethod !== 'ninku' || cl.ninkuMode !== 'prorate'}
                    value={cl.standardMinutes} onChange={(e) => setClient(i, { standardMinutes: toInt(e.target.value) })} />
                </td>
                <td>
                  <select value={cl.closingDay} onChange={(e) => setClient(i, { closingDay: Number(e.target.value) })}>
                    {DAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td className="nowrap">
                  <select value={cl.paymentMonthOffset} onChange={(e) => setClient(i, { paymentMonthOffset: Number(e.target.value) })}>
                    <option value={0}>当月</option>
                    <option value={1}>翌月</option>
                    <option value={2}>翌々月</option>
                    <option value={3}>3か月後</option>
                  </select>
                  <select value={cl.paymentDay} onChange={(e) => setClient(i, { paymentDay: Number(e.target.value) })}>
                    {DAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td>
                  <select value={cl.invoiceUnit} onChange={(e) => setClient(i, { invoiceUnit: e.target.value as Client['invoiceUnit'] })}>
                    <option value="client">元請けでまとめる</option>
                    <option value="site">現場ごと</option>
                  </select>
                </td>
                <td>
                  <select value={cl.expenseMode} onChange={(e) => setClient(i, { expenseMode: e.target.value as Client['expenseMode'] })}>
                    <option value="include">本体に含める</option>
                    <option value="separate">別の請求書</option>
                  </select>
                </td>
                <td>
                  <button className="danger" onClick={() => {
                    if (confirm(`${cl.name || cl.id} を削除します。よろしいですか?`))
                      setMasters({ ...masters, clients: masters.clients.filter((_, j) => j !== i) })
                  }}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setMasters({ ...masters, clients: [...masters.clients, newClient('', '')] })}>元請けを追加</button>

      <h3>単価表</h3>
      <p className="hint">
        単価は元請けの計算方式に合わせて「人工単価」か「時間単価」を入れます。現場を空欄にすると、その元請けの全現場に使います。
        休日単価・深夜割増は、使わない場合 0 のままにしてください。
      </p>
      {toAddRates.length > 0 && (
        <p className="callout">
          取り込んだ実績に、単価が未登録の「元請け × 勤務区分」が {toAddRates.length} 件あります。
          <button onClick={() => setMasters({ ...masters, rates: [...masters.rates, ...toAddRates] })}>
            まとめて追加
          </button>
        </p>
      )}
      <div className="scroll">
        <table className="grid edit">
          <thead>
            <tr>
              <th>元請け</th><th>現場ID(空欄=全現場)</th><th>勤務区分</th><th>単価</th>
              <th>休日単価</th><th>残業 時間単価</th><th>深夜割増 時間単価</th><th></th>
            </tr>
          </thead>
          <tbody>
            {masters.rates.map((r) => {
              const client = masters.clients.find((x) => x.id === r.clientId)
              return (
                <tr key={r.id}>
                  <td>
                    <select value={r.clientId} onChange={(e) => setRate(r.id, { clientId: e.target.value })}>
                      {!client && <option value={r.clientId}>{r.clientId}(未登録)</option>}
                      {masters.clients.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="s" value={r.siteId} onChange={(e) => setRate(r.id, { siteId: e.target.value })} />
                    <span className="sub">{r.siteId ? siteNames.get(`${r.clientId}\u0000${r.siteId}`) ?? '' : ''}</span>
                  </td>
                  <td><input className="s" value={r.shiftType} onChange={(e) => setRate(r.id, { shiftType: e.target.value })} /></td>
                  {(['unitPrice', 'holidayUnitPrice', 'overtimeHourly', 'nightAddHourly'] as const).map((k) => (
                    <td key={k}>
                      <input className="n" type="number" min={0} value={r[k]} onChange={(e) => setRate(r.id, { [k]: toInt(e.target.value) })} />
                      {k === 'unitPrice' && client && (
                        <span className="sub">{client.billingMethod === 'ninku' ? '円/人工' : '円/時間'}</span>
                      )}
                    </td>
                  ))}
                  <td>
                    <button className="danger" onClick={() => setMasters({ ...masters, rates: masters.rates.filter((x) => x.id !== r.id) })}>削除</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button onClick={() => setMasters({ ...masters, rates: [...masters.rates, newRate(masters.clients[0]?.id ?? '', '', '日勤')] })}>
        単価を追加
      </button>
    </section>
  )
}
