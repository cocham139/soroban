import type { ChangeEvent, ReactNode } from 'react'
import type { Client, Company, EquipmentRecord, Masters, RoundingMode, WorkRecord } from '../types'
import {
  missingClients,
  missingEquipmentRates,
  missingRates,
  missingSites,
  newClient,
  newEquipmentRate,
  newRate,
  newSite,
  parseMasters,
} from '../lib/masters'
import { downloadText } from '../lib/export'
import { todayString } from '../lib/period'
import { DEFAULT_SPEC } from '../lib/invoice'

interface Props {
  masters: Masters
  setMasters: (m: Masters) => void
  records: WorkRecord[]
  equipment: EquipmentRecord[]
}

const toInt = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

const DAY_OPTIONS: [number, string][] = [
  [0, '末日'],
  ...Array.from({ length: 28 }, (_, i) => [i + 1, `${i + 1}日`] as [number, string]),
]

type ListKey = 'clients' | 'sites' | 'rates' | 'equipmentRates'

function MissingCallout({ count, what, onAdd }: { count: number; what: string; onAdd: () => void }) {
  if (count === 0) return null
  return (
    <p className="callout">
      取り込んだデータに、未登録の{what}が {count} 件あります。
      <button onClick={onAdd}>まとめて追加</button>
    </p>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="scroll">
      <table className="grid edit">
        <thead>
          <tr>
            {head.map((h) => <th key={h}>{h}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export default function MastersView({ masters, setMasters, records, equipment }: Props) {
  const setCompany = (patch: Partial<Company>) => setMasters({ ...masters, company: { ...masters.company, ...patch } })

  /** 一覧の i 番目を書き換える */
  function update<K extends ListKey>(key: K, i: number, patch: Partial<Masters[K][number]>) {
    const list = masters[key].map((x, j) => (i === j ? { ...x, ...patch } : x))
    setMasters({ ...masters, [key]: list })
  }
  function remove(key: ListKey, i: number) {
    setMasters({ ...masters, [key]: masters[key].filter((_, j) => j !== i) })
  }
  function append<K extends ListKey>(key: K, items: Masters[K]) {
    setMasters({ ...masters, [key]: [...masters[key], ...items] })
  }
  const removeButton = (key: ListKey, i: number, label: string) => (
    <td>
      <button className="danger" onClick={() => confirm(`${label} を削除します。よろしいですか?`) && remove(key, i)}>
        削除
      </button>
    </td>
  )

  const clientSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {!masters.clients.some((c) => c.id === value) && <option value={value}>{value || '(選択)'}(未登録)</option>}
      {masters.clients.map((c) => <option key={c.id} value={c.id}>{c.id} {c.name}</option>)}
    </select>
  )
  const siteName = (clientId: string, siteId: string) =>
    masters.sites.find((s) => s.clientId === clientId && s.siteId === siteId)?.coverName.split('\n')[0] ??
    records.find((r) => r.clientId === clientId && r.siteId === siteId)?.siteName ??
    ''
  const billingOf = (clientId: string) => masters.clients.find((c) => c.id === clientId)?.billingMethod

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
        <label>TEL<input value={c.tel} onChange={(e) => setCompany({ tel: e.target.value })} /></label>
        <label>FAX<input value={c.fax} onChange={(e) => setCompany({ fax: e.target.value })} /></label>
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
          <textarea rows={2} value={c.bankInfo} onChange={(e) => setCompany({ bankInfo: e.target.value })} />
        </label>
      </div>
      {c.registrationNo && !/^T\d{13}$/.test(c.registrationNo) && (
        <p className="warn-text">登録番号は「T + 13桁の数字」の形式です</p>
      )}

      <h3>元請け</h3>
      <p className="hint">
        計算方式が「時間単価」なら延べ時間 × 時間単価で、夜勤帯に入る時間は夜勤単価になります
        (例: 夜勤帯 20:00〜05:00 なら、19:00〜04:00 休憩60分の勤務は 日勤1時間・夜勤7時間)。
      </p>
      <MissingCallout
        count={missingClients(records, masters).length}
        what="元請け"
        onAdd={() => append('clients', missingClients(records, masters))}
      />
      <Table head={['ID', '正式名称', '敬称', '計算方式', '夜勤帯', '人工の数え方', '所定実働(分)', '締め日', '支払', '請求単位', '経費']}>
        {masters.clients.map((cl, i) => {
          const set = (patch: Partial<Client>) => update('clients', i, patch)
          const hourly = cl.billingMethod === 'hourly'
          return (
            <tr key={i}>
              <td><input className="s" value={cl.id} onChange={(e) => set({ id: e.target.value })} /></td>
              <td><input value={cl.name} onChange={(e) => set({ name: e.target.value })} /></td>
              <td><input className="xs" value={cl.honorific} onChange={(e) => set({ honorific: e.target.value })} /></td>
              <td>
                <select value={cl.billingMethod} onChange={(e) => set({ billingMethod: e.target.value as Client['billingMethod'] })}>
                  <option value="hourly">時間単価</option>
                  <option value="ninku">人工</option>
                </select>
              </td>
              <td className="nowrap">
                <input type="time" disabled={!hourly} value={cl.nightStart} onChange={(e) => e.target.value && set({ nightStart: e.target.value })} />
                〜
                <input type="time" disabled={!hourly} value={cl.nightEnd} onChange={(e) => e.target.value && set({ nightEnd: e.target.value })} />
              </td>
              <td>
                <select disabled={hourly} value={cl.ninkuMode} onChange={(e) => set({ ninkuMode: e.target.value as Client['ninkuMode'] })}>
                  <option value="perDay">1日=1人工</option>
                  <option value="prorate">実働で按分</option>
                </select>
              </td>
              <td>
                <input className="n" type="number" min={1} disabled={hourly || cl.ninkuMode !== 'prorate'}
                  value={cl.standardMinutes} onChange={(e) => set({ standardMinutes: toInt(e.target.value) })} />
              </td>
              <td>
                <select value={cl.closingDay} onChange={(e) => set({ closingDay: Number(e.target.value) })}>
                  {DAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
              <td className="nowrap">
                <select value={cl.paymentMonthOffset} onChange={(e) => set({ paymentMonthOffset: Number(e.target.value) })}>
                  <option value={0}>当月</option>
                  <option value={1}>翌月</option>
                  <option value={2}>翌々月</option>
                  <option value={3}>3か月後</option>
                </select>
                <select value={cl.paymentDay} onChange={(e) => set({ paymentDay: Number(e.target.value) })}>
                  {DAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
              <td>
                <select value={cl.invoiceUnit} onChange={(e) => set({ invoiceUnit: e.target.value as Client['invoiceUnit'] })}>
                  <option value="client">元請けでまとめる</option>
                  <option value="site">現場ごと</option>
                </select>
              </td>
              <td>
                <select value={cl.expenseMode} onChange={(e) => set({ expenseMode: e.target.value as Client['expenseMode'] })}>
                  <option value="include">本体に含める</option>
                  <option value="separate">別の請求書</option>
                </select>
              </td>
              {removeButton('clients', i, cl.name || cl.id)}
            </tr>
          )
        })}
      </Table>
      <button onClick={() => append('clients', [newClient('', '')])}>元請けを追加</button>

      <h3>現場</h3>
      <p className="hint">
        表紙に載せる現場名(改行できます)と「仕様」欄の文言です。空欄ならCSVの現場名と「{DEFAULT_SPEC}」を使います。
      </p>
      <MissingCallout
        count={missingSites(records, equipment, masters).length}
        what="現場"
        onAdd={() => append('sites', missingSites(records, equipment, masters))}
      />
      <Table head={['元請け', '現場ID', '表紙の現場名', '仕様']}>
        {masters.sites.map((s, i) => (
          <tr key={i}>
            <td>{clientSelect(s.clientId, (v) => update('sites', i, { clientId: v }))}</td>
            <td><input className="s" value={s.siteId} onChange={(e) => update('sites', i, { siteId: e.target.value })} /></td>
            <td><textarea rows={2} cols={32} value={s.coverName} onChange={(e) => update('sites', i, { coverName: e.target.value })} /></td>
            <td><input placeholder={DEFAULT_SPEC} value={s.spec} onChange={(e) => update('sites', i, { spec: e.target.value })} /></td>
            {removeButton('sites', i, s.coverName || s.siteId)}
          </tr>
        ))}
      </Table>
      <button onClick={() => append('sites', [newSite(masters.clients[0]?.id ?? '', '')])}>現場を追加</button>

      <h3>人の単価</h3>
      <p className="hint">
        元請け × 職種 ごとの単価です。現場IDを空欄にすると、その元請けの全現場に使います(現場IDを入れた行が優先)。
        時間単価の元請けは「円/時間」、人工の元請けは「円/人工」で入れます。
      </p>
      <MissingCallout
        count={missingRates(records, masters).length}
        what="「元請け × 職種」の単価"
        onAdd={() => append('rates', missingRates(records, masters))}
      />
      <Table head={['元請け', '現場ID(空欄=全現場)', '職種', '日勤', '夜勤', '残業(人工のみ)']}>
        {masters.rates.map((r, i) => {
          const unit = billingOf(r.clientId) === 'ninku' ? '円/人工' : '円/時間'
          return (
            <tr key={r.id}>
              <td>{clientSelect(r.clientId, (v) => update('rates', i, { clientId: v }))}</td>
              <td>
                <input className="s" value={r.siteId} onChange={(e) => update('rates', i, { siteId: e.target.value })} />
                <span className="sub">{r.siteId && siteName(r.clientId, r.siteId)}</span>
              </td>
              <td><input className="s" value={r.jobType} placeholder="(空欄)" onChange={(e) => update('rates', i, { jobType: e.target.value })} /></td>
              <td>
                <input className="n" type="number" min={0} value={r.dayPrice} onChange={(e) => update('rates', i, { dayPrice: toInt(e.target.value) })} />
                <span className="sub">{unit}</span>
              </td>
              <td>
                <input className="n" type="number" min={0} value={r.nightPrice} onChange={(e) => update('rates', i, { nightPrice: toInt(e.target.value) })} />
                <span className="sub">{unit}</span>
              </td>
              <td>
                <input className="n" type="number" min={0} disabled={billingOf(r.clientId) !== 'ninku'} value={r.overtimeHourly}
                  onChange={(e) => update('rates', i, { overtimeHourly: toInt(e.target.value) })} />
                <span className="sub">円/時間</span>
              </td>
              {removeButton('rates', i, `${r.clientId} ${r.jobType}`)}
            </tr>
          )
        })}
      </Table>
      <button onClick={() => append('rates', [newRate(masters.clients[0]?.id ?? '', '', '')])}>単価を追加</button>

      <h3>機材・車両の単価</h3>
      <p className="hint">1日1台(1式)あたりの単価です。現場IDを空欄にすると、その元請けの全現場に使います。</p>
      <MissingCallout
        count={missingEquipmentRates(equipment, masters).length}
        what="機材の単価"
        onAdd={() => append('equipmentRates', missingEquipmentRates(equipment, masters))}
      />
      <Table head={['元請け', '現場ID(空欄=全現場)', '品目', '単価']}>
        {masters.equipmentRates.map((r, i) => (
          <tr key={r.id}>
            <td>{clientSelect(r.clientId, (v) => update('equipmentRates', i, { clientId: v }))}</td>
            <td>
              <input className="s" value={r.siteId} onChange={(e) => update('equipmentRates', i, { siteId: e.target.value })} />
              <span className="sub">{r.siteId && siteName(r.clientId, r.siteId)}</span>
            </td>
            <td><input value={r.item} onChange={(e) => update('equipmentRates', i, { item: e.target.value })} /></td>
            <td>
              <input className="n" type="number" min={0} value={r.unitPrice} onChange={(e) => update('equipmentRates', i, { unitPrice: toInt(e.target.value) })} />
              <span className="sub">円/日</span>
            </td>
            {removeButton('equipmentRates', i, r.item)}
          </tr>
        ))}
      </Table>
      <button onClick={() => append('equipmentRates', [newEquipmentRate(masters.clients[0]?.id ?? '', '', '')])}>
        機材の単価を追加
      </button>
    </section>
  )
}
