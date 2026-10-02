import { useEffect, useMemo, useState } from 'react'
import type { EquipmentRecord, ExpenseLine, Invoice, Masters, TaxRate, WorkRecord } from '../types'
import { buildInvoices } from '../lib/invoice'
import { breakdownsToCsv, downloadText, invoicesToCsv, issueDateOf } from '../lib/export'
import { yen } from '../lib/format'
import IssueList from './IssueList'
import CoverSheet from './CoverSheet'
import BreakdownSheet from './BreakdownSheet'

interface Props {
  records: WorkRecord[]
  equipment: EquipmentRecord[]
  masters: Masters
  expenses: Record<string, ExpenseLine[]>
  setExpenses: (e: Record<string, ExpenseLine[]>) => void
  notes: Record<string, string>
  setNotes: (n: Record<string, string>) => void
  /** 請求月(YYYY-MM) */
  month: string
  setMonth: (m: string) => void
}

export default function InvoicesView({ records, equipment, masters, expenses, setExpenses, notes, setNotes, month, setMonth }: Props) {
  /** 空なら各請求書の締め日を発行日にする */
  const [issueDate, setIssueDate] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [printAll, setPrintAll] = useState(false)

  const { invoices, issues } = useMemo(
    () => buildInvoices(records, equipment, masters, month, expenses),
    [records, equipment, masters, month, expenses],
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
  const key = current?.expenseKey
  const expenseLines = key ? expenses[key] ?? [] : []
  const setExpenseLines = (lines: ExpenseLine[]) => {
    if (!key) return
    const next = { ...expenses }
    if (lines.length > 0) next[key] = lines
    else delete next[key]
    setExpenses(next)
  }
  const updateExpense = (id: string, patch: Partial<ExpenseLine>) =>
    setExpenseLines(expenseLines.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const yyyymm = month.replace('-', '')
  const grandTotal = invoices.reduce((s, i) => s + i.total, 0)

  const sheets = (inv: Invoice) => (
    <div key={inv.number} className="invoice-set">
      <CoverSheet invoice={inv} company={masters.company} issueDate={issueDateOf(inv, issueDate)} note={notes[inv.number] ?? ''} />
      {inv.breakdowns.map((b) => (
        <BreakdownSheet key={b.title} breakdown={b} periodEnd={inv.period.to} />
      ))}
    </div>
  )

  return (
    <section className={printAll ? 'print-all' : ''}>
      <div className="no-print">
        <h2>請求書</h2>
        <div className="toolbar">
          <label>請求月 <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          <label>
            発行日 <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          {issueDate ? (
            <button onClick={() => setIssueDate('')}>締め日に戻す</button>
          ) : (
            <span className="hint">(未指定なら各請求書の締め日)</span>
          )}
        </div>
        <div className="toolbar">
          <button disabled={!current} onClick={() => window.print()}>表示中の請求書を印刷</button>
          <button disabled={invoices.length === 0} onClick={() => setPrintAll(true)}>すべて印刷</button>
          <button
            className="primary"
            disabled={invoices.length === 0}
            onClick={() => downloadText(`請求明細_${yyyymm}.csv`, invoicesToCsv(invoices, issueDate), 'text/csv')}
          >
            請求明細CSV
          </button>
          <button
            disabled={invoices.length === 0}
            onClick={() => downloadText(`内訳明細_${yyyymm}.csv`, breakdownsToCsv(invoices), 'text/csv')}
          >
            内訳明細CSV
          </button>
        </div>
        <p className="hint">
          印刷画面で「PDFに保存」を選ぶとPDFになります(表紙はA4横、内訳書はA4縦)。発行したら、PDFと請求明細CSVを共有フォルダに保存してください。
        </p>
        {companyMissing && <p className="warn-text">マスタの自社情報(社名・登録番号)が未入力です。</p>}
        <IssueList issues={issues} />

        {invoices.length === 0 ? (
          <p>この請求月に請求できる実績がありません。実績の取り込みとマスタの登録を確認してください。</p>
        ) : (
          <table className="grid">
            <thead>
              <tr><th>請求書番号</th><th>元請け</th><th>現場</th><th>対象期間</th><th>実績件数</th><th>内訳書</th><th>合計(税込)</th></tr>
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
                  <td>{inv.siteName ?? (inv.isExpenseOnly ? '(経費)' : `${inv.coverLines.filter((l) => l.siteId).length} 現場`)}</td>
                  <td>{inv.period.from} 〜 {inv.period.to}</td>
                  <td className="num">{inv.recordCount}</td>
                  <td className="num">{inv.breakdowns.length} 枚</td>
                  <td className="num">¥{yen(inv.total)}</td>
                </tr>
              ))}
              <tr className="sum">
                <td colSpan={6}>合計 {invoices.length} 件</td>
                <td className="num">¥{yen(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {current && (
          <div className="invoice-inputs">
            <div>
              <h3>経費({key}{current.client.expenseMode === 'separate' ? ` → 別の請求書 ${key}-E` : ' の表紙に追加'})</h3>
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
              <button onClick={() => setExpenseLines([...expenseLines, { id: crypto.randomUUID(), description: '', amount: 0, taxRate: 10 }])}>
                経費を追加
              </button>
            </div>
            <div>
              <h3>備考({current.number})</h3>
              <textarea
                rows={3}
                value={notes[current.number] ?? ''}
                onChange={(e) => {
                  const next = { ...notes }
                  if (e.target.value) next[current.number] = e.target.value
                  else delete next[current.number]
                  setNotes(next)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {printAll ? invoices.map(sheets) : current && sheets(current)}
    </section>
  )
}
