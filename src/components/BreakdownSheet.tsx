import type { Breakdown } from '../types'
import { monthDay, qty, reiwaMonth, yen } from '../lib/format'

interface Props {
  breakdown: Breakdown
  periodEnd: string
}

/** 内訳書(A4縦)。1行 = 日 × 工事名 × 時間。行が多ければ印刷時に自動で次のページへ続く */
export default function BreakdownSheet({ breakdown: b, periodEnd }: Props) {
  if (b.layout === 'lines') {
    // 見積書の品目で請求するとき: 1行に1品目(日付・時間・工事名・品目・数量・単位・単価・金額)
    return (
      <article className="sheet breakdown">
        <header className="breakdown-head">
          <span>{reiwaMonth(periodEnd)}</span>
          <h3>{b.title}</h3>
        </header>
        <table className="breakdown-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>時間</th>
              <th>工事名</th>
              <th>品目(仕様)</th>
              <th>数量</th>
              <th>単位</th>
              <th>単価</th>
              <th>金額</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                <td className="nowrap">{r.date ? monthDay(r.date) : ''}</td>
                <td className="nowrap">{r.time.replace('-', ' - ')}</td>
                <td>{r.work}</td>
                <td>{r.item?.name}</td>
                <td className="num">{qty(r.item?.quantity)}</td>
                <td className="center">{r.item?.unit}</td>
                <td className="num">{r.item ? yen(r.item.unitPrice) : ''}</td>
                <td className="num">{yen(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={7}>合　　計</th>
              <td className="num">{yen(b.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </article>
    )
  }
  return (
    <article className="sheet breakdown">
      <header className="breakdown-head">
        <span>{reiwaMonth(periodEnd)}</span>
        <h3>{b.title}</h3>
      </header>
      <table className="breakdown-table">
        <thead>
          <tr>
            <th rowSpan={2}>日付</th>
            <th rowSpan={2}>工事名</th>
            <th rowSpan={2}>時間</th>
            {b.columns.map((c) => <th key={c.key}>{c.label}<span className="unit">({c.unit})</span></th>)}
            <th rowSpan={2}>小計</th>
          </tr>
          <tr>
            {b.columns.map((c) => <th key={c.key} className="price">@{yen(c.unitPrice)}</th>)}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>
              <td className="nowrap">{r.date ? monthDay(r.date) : ''}</td>
              <td>{r.work}</td>
              <td className="nowrap">{r.time.replace('-', ' - ')}</td>
              {b.columns.map((c) => <td key={c.key} className="num">{qty(r.quantities[c.key])}</td>)}
              <td className="num">{r.amount ? yen(r.amount) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>合　　計</th>
            {b.columns.map((c) => <td key={c.key} className="num">{qty(b.totals[c.key])}</td>)}
            <td className="num">{yen(b.amount)}</td>
          </tr>
        </tfoot>
      </table>
    </article>
  )
}
