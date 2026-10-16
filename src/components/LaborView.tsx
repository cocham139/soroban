import { useMemo, useState } from 'react'
import type { Masters, WorkRecord } from '../types'
import { OWN, summarizeLabor, type PersonSummary } from '../lib/labor'
import { billingPeriod } from '../lib/period'
import { downloadText } from '../lib/export'
import { toCsv } from '../lib/csv'
import { yen } from '../lib/format'

interface Props {
  records: WorkRecord[]
  masters: Masters
  month: string
}

const hours = (min: number) => Math.round((min / 60) * 100) / 100
const amountText = (amount: number, missing: number) =>
  missing > 0 ? (amount > 0 ? `¥${yen(amount)}(+単価なし ${missing}件)` : `単価なし ${missing}件`) : `¥${yen(amount)}`

const CLOSING: [number, string][] = [[0, '末日締め'], [10, '10日締め'], [15, '15日締め'], [20, '20日締め'], [25, '25日締め']]

/** 隊員ごと(労務費)・協力業者ごと(外注費チェック)の集計 */
export default function LaborView({ records, masters, month: initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [closing, setClosing] = useState(0)
  const [aff, setAff] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const period = useMemo(() => billingPeriod(month, closing), [month, closing])
  const { people, affiliations } = useMemo(
    () => summarizeLabor(records, masters.payRates, period.from, period.to),
    [records, masters.payRates, period],
  )
  const shown = aff ? people.filter((p) => p.affiliation === aff) : people
  const noAffiliation = records.length > 0 && records.every((r) => !r.affiliation)
  const label = `${month.replace('-', '')}${aff ? `_${aff}` : ''}`

  const summaryCsv = () =>
    toCsv([
      ['所属', '隊員ID', '隊員名', '出勤日数', '日勤回数', '夜勤回数', '延べ実働(時間)', '残業(時間)', '支払額', '単価なしの勤務'],
      ...shown.map((p) => [p.affiliation, p.staffId, p.staffName, p.days, p.dayShifts, p.nightShifts, hours(p.workMinutes), hours(p.overtimeMinutes), p.amount, p.missingRate]),
    ])
  const detailCsv = () =>
    toCsv([
      ['所属', '隊員ID', '隊員名', '勤務日', '元請け', '現場', '工事名', '職種', '勤務区分', '開始', '終了', '休憩分', '実働分', '残業分', '伝票番号', '支払額'],
      ...shown.flatMap((p) =>
        p.lines.map(({ record: r, amount }) => [
          p.affiliation, r.staffId, r.staffName, r.date, r.clientName, r.siteName, r.work, r.jobType, r.shiftType,
          r.start, r.end, r.breakMinutes, r.workMinutes, r.overtimeMinutes, r.slipNo, amount ?? '',
        ]),
      ),
    ])

  const detail = (p: PersonSummary) => (
    <tr key={p.key + ':detail'} className="labor-detail">
      <td colSpan={9}>
        <table className="grid">
          <thead>
            <tr><th>勤務日</th><th>元請け</th><th>現場・工事名</th><th>勤務区分</th><th>時間</th><th>実働</th><th>残業</th><th>伝票番号</th><th>支払額</th></tr>
          </thead>
          <tbody>
            {p.lines.map(({ record: r, amount }) => (
              <tr key={r.id}>
                <td className="nowrap">{r.date}</td>
                <td>{r.clientName}</td>
                <td>{r.siteName}{r.work && r.work !== r.siteName ? ` / ${r.work}` : ''}</td>
                <td>{r.shiftType}</td>
                <td className="nowrap">{r.start}-{r.end}</td>
                <td className="num">{hours(r.workMinutes)}h</td>
                <td className="num">{r.overtimeMinutes ? `${hours(r.overtimeMinutes)}h` : ''}</td>
                <td>{r.slipNo}</td>
                <td className="num">{amount === null ? <span className="warn-text">単価なし</span> : `¥${yen(amount)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )

  return (
    <section>
      <div className="no-print">
        <h2>隊員・外注費</h2>
        <p className="hint">
          SHIRUBEの実績を、隊員ごとにまとめます。自社の隊員は労務費(給与計算の元)、協力業者は外注費のチェック(業者からの請求と見比べる)に使います。
          金額は、マスタの「支払単価」から計算します。単価がない勤務は日数・時間だけを数えます。
        </p>
        <div className="toolbar">
          <label>月 <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          <select value={closing} onChange={(e) => setClosing(Number(e.target.value))}>
            {CLOSING.map(([d, t]) => <option key={d} value={d}>{t}</option>)}
          </select>
          <span className="hint">対象: {period.from} 〜 {period.to}</span>
          <label>
            所属{' '}
            <select value={aff} onChange={(e) => setAff(e.target.value)}>
              <option value="">すべて</option>
              {affiliations.map((a) => <option key={a.affiliation} value={a.affiliation}>{a.affiliation}</option>)}
            </select>
          </label>
        </div>
        <div className="toolbar">
          <button disabled={shown.length === 0} onClick={() => downloadText(`隊員別集計_${label}.csv`, summaryCsv(), 'text/csv')}>
            隊員ごとの集計CSV
          </button>
          <button disabled={shown.length === 0} onClick={() => downloadText(`勤務明細_${label}.csv`, detailCsv(), 'text/csv')}>
            勤務の明細CSV(1行=1勤務)
          </button>
          <button disabled={shown.length === 0} onClick={() => window.print()}>表示中のものを印刷</button>
        </div>
        {noAffiliation && (
          <p className="callout">
            取り込んだCSVに「所属」の列がないため、全員を自社として集計しています。SHIRUBEで実績明細CSVを出し直すと、協力業者ごとに分かれます。
          </p>
        )}
      </div>

      {people.length === 0 ? (
        <p>この期間の実績がありません。実績の取り込みと月を確認してください。</p>
      ) : (
        <>
          <h3>所属ごとの合計</h3>
          <table className="grid">
            <thead>
              <tr><th>所属</th><th>用途</th><th>人数</th><th>のべ人日</th><th>勤務回数</th><th>延べ実働</th><th>残業</th><th>支払額</th></tr>
            </thead>
            <tbody>
              {affiliations.map((a) => (
                <tr
                  key={a.affiliation}
                  className={aff === a.affiliation ? 'selected clickable' : 'clickable'}
                  onClick={() => setAff(aff === a.affiliation ? '' : a.affiliation)}
                >
                  <td>{a.affiliation}</td>
                  <td>{a.affiliation === OWN ? '労務費' : '外注費'}</td>
                  <td className="num">{a.people}</td>
                  <td className="num">{a.personDays}</td>
                  <td className="num">{a.shifts}</td>
                  <td className="num">{hours(a.workMinutes)}h</td>
                  <td className="num">{a.overtimeMinutes ? `${hours(a.overtimeMinutes)}h` : ''}</td>
                  <td className="num">{amountText(a.amount, a.missingRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>隊員ごと{aff ? `(${aff})` : ''}</h3>
          <p className="hint no-print">行を押すと、その隊員の勤務の明細が開きます。</p>
          <table className="grid">
            <thead>
              <tr><th>所属</th><th>隊員</th><th>出勤日数</th><th>日勤</th><th>夜勤</th><th>延べ実働</th><th>残業</th><th>支払額</th><th></th></tr>
            </thead>
            <tbody>
              {shown.flatMap((p) => [
                <tr key={p.key} className={open === p.key ? 'selected clickable' : 'clickable'} onClick={() => setOpen(open === p.key ? null : p.key)}>
                  <td>{p.affiliation}</td>
                  <td>{p.staffName}</td>
                  <td className="num">{p.days}日</td>
                  <td className="num">{p.dayShifts}</td>
                  <td className="num">{p.nightShifts}</td>
                  <td className="num">{hours(p.workMinutes)}h</td>
                  <td className="num">{p.overtimeMinutes ? `${hours(p.overtimeMinutes)}h` : ''}</td>
                  <td className="num">{amountText(p.amount, p.missingRate)}</td>
                  <td className="no-print">{open === p.key ? '▲' : '▼'}</td>
                </tr>,
                ...(open === p.key ? [detail(p)] : []),
              ])}
              <tr className="sum">
                <td colSpan={2}>合計 {shown.length} 人</td>
                <td className="num">{shown.reduce((s, p) => s + p.days, 0)}日</td>
                <td className="num">{shown.reduce((s, p) => s + p.dayShifts, 0)}</td>
                <td className="num">{shown.reduce((s, p) => s + p.nightShifts, 0)}</td>
                <td className="num">{hours(shown.reduce((s, p) => s + p.workMinutes, 0))}h</td>
                <td className="num">{hours(shown.reduce((s, p) => s + p.overtimeMinutes, 0))}h</td>
                <td className="num">¥{yen(shown.reduce((s, p) => s + p.amount, 0))}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
