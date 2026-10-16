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

export interface OverrideRow {
  key: string
  date: string
  time: string
  work: string
  slipNo: string
  itemId: string
  itemName: string
  clientId: string
  siteId: string
}

interface RowListProps {
  rows: OverrideRow[]
  masters: Masters
  setMasters: (m: Masters) => void
  overrides: ItemOverrides
  setOverrides: (o: ItemOverrides) => void
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const weekday = (date: string) => WEEK[new Date(`${date}T00:00:00`).getDay()] ?? ''
/** 全角・半角の空白やかっこの違いを無視して比べる */
const norm = (s: string) =>
  s
    .replace(/[\s　]/g, '')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .toLowerCase()

/**
 * 請求書の画面: 内訳書の行ごとに品目を直す(その日だけ切替が増えた、など)。
 * 速く直せるように: よく使う品目のボタン、「↑と同じ」、まとめて直す、品目の絞り込み、伝票番号の表示。
 */
export function RowOverridePanel({ rows, masters, setMasters, overrides, setOverrides }: RowListProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  if (rows.length === 0) return null

  // 昼と夜で品目が分かれた行(1つの作業から2行)は、1行にまとめて扱う
  const list: OverrideRow[] = []
  for (const r of rows) if (!list.some((x) => x.key === r.key)) list.push(r)

  const effective = (r: OverrideRow) => overrides[r.key] ?? r.itemId
  const changed = list.filter((r) => overrides[r.key]).length
  const words = filter.split(/[\s　]+/).filter(Boolean).map(norm)
  const choices = (r: OverrideRow) => {
    const all = itemsFor(masters.quoteItems, r.clientId, r.siteId)
    return words.length === 0 ? all : all.filter((q) => q.id === effective(r) || words.every((w) => norm(q.name).includes(w)))
  }
  // よく使う品目(この請求書で使っている回数の多い順に4つ)
  const freq = new Map<string, number>()
  for (const r of list) freq.set(effective(r), (freq.get(effective(r)) ?? 0) + 1)
  const used = [...freq.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([id]) => masters.quoteItems.find((q) => q.id === id))
    .filter((q): q is QuoteItem => !!q)
  // 絞り込みの言葉を入れたら、当てはまる品目をボタンの先頭に出す(入れた言葉の品目を1回押しで選べる)
  const matched =
    words.length === 0 || list.length === 0
      ? []
      : itemsFor(masters.quoteItems, list[0].clientId, list[0].siteId).filter((q) => words.every((w) => norm(q.name).includes(w)))
  const favorites = [...matched, ...used].filter((q, i, all) => all.findIndex((x) => x.id === q.id) === i).slice(0, 5)

  const apply = (keys: string[], id: string) => {
    const next = { ...overrides }
    for (const k of keys) {
      if (id) next[k] = id
      else delete next[k]
    }
    setOverrides(next)
  }
  const toggle = (key: string) => {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setChecked(next)
  }
  const selected = list.filter((r) => checked.has(r.key))
  const first = selected[0] ?? list[0]
  // ボタンには品目名の頭と終わり(×Ⅱ うち切替1回 など、見分けるところ)を残して短くする
  const short = (name: string) => {
    const n = name.replace(/^一般道[\s　]*/, '')
    return n.length > 20 ? `${n.slice(0, 9)}…${n.slice(-10)}` : n
  }

  return (
    <details className="assign-panel" open>
      <summary>
        内訳の行ごとに品目を直す({list.length}行{changed > 0 ? `、うち ${changed} 行を変更済み` : ''})
      </summary>
      <p className="hint">
        その日だけ品目が違う(切替の回数が増えた など)ときに使います。伝票番号を見ながら、右の品目のボタンを押すか、「↑と同じ」で前の行と同じにできます。
        「品目を絞り込む」に言葉(例: 交差点、切替1回)を入れると、当てはまる品目がボタンに出ます。チェックを付けた行は、まとめて同じ品目にできます。
      </p>
      <div className="toolbar">
        <label>
          品目を絞り込む{' '}
          <input value={filter} placeholder="例: 片側 切替1回" onChange={(e) => setFilter(e.target.value)} />
        </label>
        {filter && <button onClick={() => setFilter('')}>絞り込みを消す</button>}
      </div>
      {selected.length > 0 && (
        <div className="bulk-bar">
          <span>選んだ {selected.length} 行を</span>
          <ItemPicker
            items={choices(first)}
            value=""
            onChange={(id) => {
              if (!id) return
              apply(selected.map((r) => r.key), id)
              setChecked(new Set())
            }}
            onCreate={createItem(masters, setMasters, first.clientId, first.siteId)}
            emptyLabel="(この品目にする)"
          />
          <button
            onClick={() => {
              apply(selected.map((r) => r.key), '')
              setChecked(new Set())
            }}
          >
            対応づけどおりに戻す
          </button>
          <button onClick={() => setChecked(new Set())}>選ぶのをやめる</button>
        </div>
      )}
      <div className="scroll">
        <table className="grid edit">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  title="全部選ぶ"
                  checked={selected.length === list.length}
                  onChange={(e) => setChecked(e.target.checked ? new Set(list.map((r) => r.key)) : new Set())}
                />
              </th>
              <th>日付</th>
              <th>時間</th>
              <th>作業名</th>
              <th>伝票番号</th>
              <th>品目</th>
              <th>すぐ選ぶ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const cur = effective(r)
              const prev = i > 0 ? effective(list[i - 1]) : ''
              return (
                <tr key={r.key} className={overrides[r.key] ? 'row-changed' : ''}>
                  <td><input type="checkbox" checked={checked.has(r.key)} onChange={() => toggle(r.key)} /></td>
                  <td className="nowrap">{r.date.slice(5).replace('-', '/')}({weekday(r.date)})</td>
                  <td className="nowrap">{r.time}</td>
                  <td>{r.work}</td>
                  <td className="nowrap">{r.slipNo}</td>
                  <td>
                    <ItemPicker
                      items={choices(r)}
                      value={overrides[r.key] ?? ''}
                      onChange={(id) => apply([r.key], id)}
                      onCreate={createItem(masters, setMasters, r.clientId, r.siteId)}
                      emptyLabel={`(対応づけどおり: ${r.itemName})`}
                    />
                  </td>
                  <td className="quick">
                    <button disabled={i === 0 || prev === cur} title="前の行と同じ品目にする" onClick={() => apply([r.key], prev)}>
                      ↑と同じ
                    </button>
                    {favorites.map((q) => (
                      <button
                        key={q.id}
                        className={q.id === cur ? 'chip chip-on' : 'chip'}
                        title={q.name}
                        disabled={q.id === cur}
                        onClick={() => apply([r.key], q.id)}
                      >
                        {short(q.name)}
                      </button>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
