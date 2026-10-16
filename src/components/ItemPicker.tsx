import { useState } from 'react'
import type { QuoteItem } from '../types'
import { yen } from '../lib/format'

interface Props {
  items: QuoteItem[]
  value: string
  onChange: (id: string) => void
  /** 見積書にない品目を足す。足した品目のIDを返す */
  onCreate: (o: { name: string; unit: string; unitPrice: number }) => string
  /** 未選択のときの表示 */
  emptyLabel: string
}

const NEW = '__new__'

/** 見積書の品目を選ぶ。リストにない品目は、その場で足せる(足した品目は「追加の見積書が必要」になる) */
export default function ItemPicker({ items, value, onChange, onCreate, emptyLabel }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('日')
  const [price, setPrice] = useState('')

  if (adding) {
    return (
      <span className="item-new">
        <input placeholder="品目名" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="xs" placeholder="単位" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <input className="n" type="number" min={0} placeholder="単価" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button
          className="primary"
          disabled={!name.trim() || !(Number(price) > 0)}
          onClick={() => {
            onChange(onCreate({ name: name.trim(), unit: unit.trim() || '日', unitPrice: Math.trunc(Number(price)) }))
            setAdding(false)
            setName('')
            setPrice('')
          }}
        >
          足す
        </button>
        <button onClick={() => setAdding(false)}>やめる</button>
      </span>
    )
  }
  return (
    <select
      className="item-select"
      value={value}
      onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}
    >
      <option value="">{emptyLabel}</option>
      {items.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}({yen(q.unitPrice)}円/{q.unit}){q.needsQuote ? ' ※追加見積' : ''}
        </option>
      ))}
      <option value={NEW}>＋ 見積書にない品目を足す(追加見積が必要)</option>
    </select>
  )
}
