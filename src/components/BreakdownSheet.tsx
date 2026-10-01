import type { Breakdown } from '../types'
import { monthDay, qty, reiwaMonth, yen } from '../lib/format'

interface Props {
  breakdown: Breakdown
  periodEnd: string
}

/** 内訳書(A4縦)。1行 = 日 × 作業内容 × 時間。行が多ければ印刷時に自動で次のページへ続く */
export default function BreakdownSheet({ breakdown: b, periodEnd }: Props) {
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
              <td className="nowrap">{monthDay(r.date)}</td>
              <td>{r.work}</td>
              <td className="nowrap">{r.time.replace('-', ' - ')}</td>
              {b.columns.map((c) => <td key={c.key} className="num">{qty(r.quantities[c.key])}</td>)}
              <td className="num">{yen(r.amount)}</td>
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
