import { useEffect, useMemo, useState } from 'react'
import type { ExpenseLine, Masters, TaxRate, WorkRecord } from '../types'
import { buildInvoices } from '../lib/invoice'
import { downloadText, invoicesToCsv } from '../lib/export'
import { previousMonth, todayString } from '../lib/period'
import IssueList from './IssueList'
import InvoiceSheet from './InvoiceSheet'

interface Props {
  records: WorkRecord[]
  masters: Masters
  expenses: Record<string, ExpenseLine[]>
  setExpenses: (e: Record<string, ExpenseLine[]>) => void
}

export default function InvoicesView({ records, masters, expenses, setExpenses }: Props) {
  const [month, setMonth] = useState(() => previousMonth(new Date()))
  const [issueDate, setIssueDate] = useState(() => todayString(new Date()))
  const [selected, setSelected] = useState<string | null>(null)
  const [printAll, setPrintAll] = useState(false)

  const { invoices, issues } = useMemo(
    () => buildInvoices(records, masters, month, expenses),
    [records, masters, month, expenses],
  )
  const current = invoices.find((i) => i.number === selected) ?? invoices[0]

  useEffect(() => {
    if (!printAll) return
    const done = () => setPrintAll(false)
    window.addEventListener('afterprint', done, { once: true })
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printAll])

  const companyMissing = !masters.company.name || !masters.company.registrationNo
  const expenseKey = current?.expenseKey
  const expenseLines = expenseKey ? expenses[expenseKey] ?? [] : []
  const setExpenseLines = (lines: ExpenseLine[]) => {
    if (!expenseKey) return
    const next = { ...expenses }
    if (lines.length > 0) next[expenseKey] = lines
    else delete next[expenseKey]
    setExpenses(next)
  }
  const updateExpense = (id: string, patch: Partial<ExpenseLine>) =>
    setExpenseLines(expenseLines.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const grandTotal = invoices.reduce((s, i) => s + i.total, 0)

  return (
    <section className={printAll ? 'print-all' : ''}>
      <div className="no-print">
        <h2>請求書</h2>
        <div className="toolbar">
          <label>請求月 <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          <label>発行日 <input type="date" value={issueDate} onChange={(e) => e.target.value && setIssueDate(e.target.value)} /></label>
          <button disabled={!current} onClick={() => window.print()}>表示中の請求書を印刷</button>
          <button disabled={invoices.length === 0} onClick={() => setPrintAll(true)}>すべて印刷</button>
          <button
            className="primary"
            disabled={invoices.length === 0}
            onClick={() => downloadText(`請求明細_${month.replace('-', '')}.csv`, invoicesToCsv(invoices, issueDate), 'text/csv')}
          >
            請求明細CSVを出力
          </button>
        </div>
        <p className="hint">印刷画面で「PDFに保存」を選ぶとPDFになります。発行したら、PDFと請求明細CSVを共有フォルダに保存してください。</p>
        {companyMissing && <p className="warn-text">マスタの自社情報(社名・登録番号)が未入力です。</p>}
        <IssueList issues={issues} />

        {invoices.length === 0 ? (
          <p>この請求月に請求できる実績がありません。実績の取り込みとマスタの登録を確認してください。</p>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>請求書番号</th><th>元請け</th><th>現場</th><th>対象期間</th><th>実績件数</th><th>合計(税込)</th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.number}
                  className={inv.number === current?.number ? 'selected clickable' : 'clickable'}
                  onClick={() => setSelected(inv.number)}
                >
                  <td>{inv.number}</td>
                  <td>{inv.client.name}</td>
                  <td>{inv.siteName ?? (inv.isExpenseOnly ? '(経費)' : '全現場')}</td>
                  <td>{inv.period.from} 〜 {inv.period.to}</td>
                  <td className="num">{inv.recordCount}</td>
                  <td className="num">¥{inv.total.toLocaleString('ja-JP')}</td>
                </tr>
              ))}
              <tr className="sum">
                <td colSpan={5}>合計 {invoices.length} 枚</td>
                <td className="num">¥{grandTotal.toLocaleString('ja-JP')}</td>
              </tr>
            </tbody>
          </table>
        )}

        {current && (
          <div className="expenses">
            <h3>経費({expenseKey}{current.client.expenseMode === 'separate' ? ' → 別の請求書 ' + expenseKey + '-E' : ' に含める'})</h3>
            {expenseLines.map((e) => (
              <div key={e.id} className="expense-row">
                <input placeholder="摘要(交通費・駐車場代など)" value={e.description} onChange={(ev) => updateExpense(e.id, { description: ev.target.value })} />
                <input className="n" type="number" value={e.amount} onChange={(ev) => updateExpense(e.id, { amount: Math.trunc(Number(ev.target.value) || 0) })} />
                <span>円(税抜)</span>
                <select value={e.taxRate} onChange={(ev) => updateExpense(e.id, { taxRate: Number(ev.target.value) as TaxRate })}>
                  <option value={10}>10%</option>
                  <option value={0}>対象外(立替金など)</option>
                </select>
                <button className="danger" onClick={() => setExpenseLines(expenseLines.filter((x) => x.id !== e.id))}>削除</button>
              </div>
            ))}
            <button
              onClick={() =>
                setExpenseLines([...expenseLines, { id: crypto.randomUUID(), description: '', amount: 0, taxRate: 10 }])
              }
            >
              経費を追加
            </button>
          </div>
        )}
      </div>

      {printAll
        ? invoices.map((inv) => (
            <InvoiceSheet key={inv.number} invoice={inv} company={masters.company} issueDate={issueDate} />
          ))
        : current && <InvoiceSheet invoice={current} company={masters.company} issueDate={issueDate} />}
    </section>
  )
}
