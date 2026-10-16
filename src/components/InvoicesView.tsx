import { useEffect, useMemo, useState } from 'react'
import type { EquipmentRecord, ExpenseLine, Invoice, ItemOverrides, Masters, TaxRate, Unassigned, WorkRecord } from '../types'
import { RowOverridePanel, UnassignedPanel } from './AssignPanel'
import { buildInvoices, expenseAmount } from '../lib/invoice'
import { breakdownsToCsv, downloadText, invoicesToCsv, issueDateOf } from '../lib/export'
import { yen } from '../lib/format'
import IssueList from './IssueList'
import CoverSheet from './CoverSheet'
import BreakdownSheet from './BreakdownSheet'

interface Props {
  setMasters: (m: Masters) => void
  overrides: ItemOverrides
  setOverrides: (o: ItemOverrides) => void
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

export default function InvoicesView({
  records, equipment, masters, setMasters, expenses, setExpenses, notes, setNotes, month, setMonth, overrides, setOverrides,
}: Props) {
  /** 空なら各請求書の締め日を発行日にする */
  const [issueDate, setIssueDate] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [printAll, setPrintAll] = useState(false)

  const { invoices, issues } = useMemo(
    () => buildInvoices(records, equipment, masters, month, expenses, overrides),
    [records, equipment, masters, month, expenses, overrides],
  )
  // 割り当て待ちは、請求書をまたいで同じ組み合わせを1行にまとめる
  const unassigned = useMemo(() => {
    const m = new Map<string, Unassigned>()
    for (const u of invoices.flatMap((i) => i.unassigned)) {
      const k = [u.clientId, u.siteId, u.jobType, u.work].join('|')
      const cur = m.get(k)
      m.set(k, cur ? { ...cur, rows: cur.rows + u.rows, hasNight: cur.hasNight || u.hasNight } : u)
    }
    return [...m.values()]
  }, [invoices])
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
        <UnassignedPanel list={unassigned} masters={masters} setMasters={setMasters} />

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
                  <td className="nowrap">
                    {inv.number}
                    {inv.unassigned.length > 0 && <span className="draft-badge">下書き</span>}
                  </td>
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
          <RowOverridePanel
            rows={current.breakdowns
              .filter((b) => b.layout === 'lines')
              .flatMap((b) =>
                b.rows
                  .filter((r) => r.key && r.item)
                  .map((r) => ({
                    key: r.key!,
                    date: r.date,
                    time: r.time,
                    work: r.work,
                    slipNo: r.slipNo ?? '',
                    itemId: r.item!.id ?? '',
                    itemName: r.item!.name,
                    clientId: current.client.id,
                    siteId: b.siteId,
                  })),
              )}
            masters={masters}
            setMasters={setMasters}
            overrides={overrides}
            setOverrides={setOverrides}
          />
        )}
        {current && (
          <div className="invoice-inputs">
            <div>
              <h3>経費・その他の請求({key}{current.client.expenseMode === 'separate' ? ` → 別の請求書 ${key}-E` : ' の表紙に追加'})</h3>
              <p className="hint">交通費などの経費のほか、単価マスタにない請求も、品目・数量・単位・単価を自由に入れて表紙に足せます。</p>
              {expenseLines.map((e) => (
                <div key={e.id} className="expense-row">
                  <input placeholder="品目・摘要(交通費・規制材の運搬など)" value={e.description} onChange={(ev) => updateExpense(e.id, { description: ev.target.value })} />
                  <input className="xs" type="number" min={0} step="any" value={e.quantity ?? 1} title="数量"
                    onChange={(ev) => updateExpense(e.id, { quantity: Number(ev.target.value) || 0, unitPrice: e.unitPrice ?? e.amount })} />
                  <input className="xs" placeholder="式" value={e.unit ?? ''} title="単位(自由入力)"
                    onChange={(ev) => updateExpense(e.id, { unit: ev.target.value, unitPrice: e.unitPrice ?? e.amount })} />
                  <span>×</span>
                  <input className="n" type="number" value={e.unitPrice ?? e.amount} title="単価"
                    onChange={(ev) => updateExpense(e.id, { unitPrice: Math.trunc(Number(ev.target.value) || 0), quantity: e.quantity ?? 1 })} />
                  <span>円 = ¥{yen(expenseAmount(e))}(税抜)</span>
                  <select value={e.taxRate} onChange={(ev) => updateExpense(e.id, { taxRate: Number(ev.target.value) as TaxRate })}>
                    <option value={10}>10%</option>
                    <option value={0}>対象外(立替金など)</option>
                  </select>
                  <button className="danger" onClick={() => setExpenseLines(expenseLines.filter((x) => x.id !== e.id))}>削除</button>
                </div>
              ))}
              <button
                onClick={() =>
                  setExpenseLines([...expenseLines, { id: crypto.randomUUID(), description: '', amount: 0, taxRate: 10, quantity: 1, unit: '式', unitPrice: 0 }])
                }
              >
                行を追加
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
