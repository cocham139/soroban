import { useState } from 'react'
import type { ItemOverrides, Masters, QuoteItem, Unassigned } from '../types'
import { basisFromUnit, itemsFor } from '../lib/items'
import { newItemRule, newQuoteItem } from '../lib/masters'
import ItemPicker from './ItemPicker'

/** 見積書にない品目を足す(追加の見積書が必要な品目として) */
function createItem(masters: Masters, setMasters: (m: Masters) => void, clientId: string, siteId: string) {
  return (o: { name: string; unit: string; unitPrice: number }) => {
    const item: QuoteItem = newQuoteItem(clientId, siteId, { ...o, basis: basisFromUnit(o.unit), needsQuote: true })
    setMasters({ ...masters, quoteItems: [...masters.quoteItems, item] })
    return item.id
  }
}

function AssignRow({ u, masters, setMasters }: { u: Unassigned; masters: Masters; setMasters: (m: Masters) => void }) {
  const [day, setDay] = useState('')
  const [night, setNight] = useState('')
  const [anyWork, setAnyWork] = useState(false)
  // 足した品目はmastersが変わってから選べるので、ここでは今のmastersに足したものとして扱う
  const items = itemsFor(masters.quoteItems, u.clientId, u.siteId)
  const create = createItem(masters, setMasters, u.clientId, u.siteId)
  return (
    <tr>
      <td className="nowrap">{u.clientName}</td>
      <td>{u.siteName}</td>
      <td>{u.jobType || '(空欄)'}</td>
      <td>{u.work || '(空欄)'}</td>
      <td className="num">{u.rows}</td>
      <td>
        <ItemPicker items={items} value={day} onChange={setDay} onCreate={create} emptyLabel="(品目を選ぶ)" />
        {u.hasNight && (
          <div className="sub">
            夜の分:{' '}
            <ItemPicker items={items} value={night} onChange={setNight} onCreate={create} emptyLabel="(昼と同じ)" />
          </div>
        )}
      </td>
      <td>
        <label className="nowrap sub">
          <input type="checkbox" checked={anyWork} onChange={(e) => setAnyWork(e.target.checked)} /> 作業名に関係なく
        </label>
      </td>
      <td>
        <button
          className="primary"
          disabled={!day}
          onClick={() =>
            setMasters({
              ...masters,
              itemRules: [
                ...masters.itemRules,
                newItemRule({
                  clientId: u.clientId,
                  siteId: u.siteId,
                  jobType: u.jobType,
                  work: anyWork ? '' : u.work,
                  dayItemId: day,
                  nightItemId: night,
                }),
              ],
            })
          }
        >
          割り当てる
        </button>
      </td>
    </tr>
  )
}

/** 請求書の画面: 品目の割り当て待ち。一度割り当てると対応づけとして覚え、次の月からは自動 */
export function UnassignedPanel({ list, masters, setMasters }: { list: Unassigned[]; masters: Masters; setMasters: (m: Masters) => void }) {
  if (list.length === 0) return null
  return (
    <div className="assign-panel">
      <h3>品目の割り当て待ち({list.length}件)</h3>
      <p className="hint">
        見積書のどの品目で請求するかを選んでください。一度割り当てると覚えるので、次からは自動で割り当てます。
        割り当てが終わるまで、その請求書は下書きです。見積書にない品目は「＋見積書にない品目を足す」で足せます(追加の見積書が必要と表示されます)。
      </p>
      <div className="scroll">
        <table className="grid edit">
          <thead>
            <tr><th>元請け</th><th>現場</th><th>職種</th><th>作業名</th><th>行数</th><th>品目</th><th></th><th></th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <AssignRow key={[u.clientId, u.siteId, u.jobType, u.work].join('|')} u={u} masters={masters} setMasters={setMasters} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface RowListProps {
  rows: { key: string; date: string; time: string; work: string; itemName: string; clientId: string; siteId: string }[]
  masters: Masters
  setMasters: (m: Masters) => void
  overrides: ItemOverrides
  setOverrides: (o: ItemOverrides) => void
}

/** 請求書の画面: 内訳書の行ごとに品目を直す(その日だけ切替が増えた、など) */
export function RowOverridePanel({ rows, masters, setMasters, overrides, setOverrides }: RowListProps) {
  if (rows.length === 0) return null
  const changed = rows.filter((r) => overrides[r.key]).length
  return (
    <details className="assign-panel">
      <summary>
        内訳の行ごとに品目を直す({rows.length}行{changed > 0 ? `、うち ${changed} 行を変更済み` : ''})
      </summary>
      <p className="hint">その日だけ品目が違う(切替の回数が増えた など)ときに使います。ほかの日には影響しません。</p>
      <div className="scroll">
        <table className="grid edit">
          <thead><tr><th>日付</th><th>時間</th><th>作業名</th><th>品目</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key + r.itemName}>
                <td className="nowrap">{r.date}</td>
                <td className="nowrap">{r.time}</td>
                <td>{r.work}</td>
                <td>
                  <ItemPicker
                    items={itemsFor(masters.quoteItems, r.clientId, r.siteId)}
                    value={overrides[r.key] ?? ''}
                    onChange={(id) => {
                      const next = { ...overrides }
                      if (id) next[r.key] = id
                      else delete next[r.key]
                      setOverrides(next)
                    }}
                    onCreate={createItem(masters, setMasters, r.clientId, r.siteId)}
                    emptyLabel={`(対応づけどおり: ${r.itemName})`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
