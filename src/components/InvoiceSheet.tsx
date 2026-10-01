import type { Company, Invoice } from '../types'

const yen = (n: number) => n.toLocaleString('ja-JP')
const jpDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

interface Props {
  invoice: Invoice
  company: Company
  issueDate: string
}

/** A4 1枚の請求書(画面プレビューと印刷で共通) */
export default function InvoiceSheet({ invoice, company, issueDate }: Props) {
  const { client } = invoice
  return (
    <article className="sheet">
      <header className="sheet-head">
        <h2>{invoice.isExpenseOnly ? '請求書(経費)' : '請求書'}</h2>
        <dl className="sheet-meta">
          <dt>請求書番号</dt><dd>{invoice.number}</dd>
          <dt>発行日</dt><dd>{jpDate(issueDate)}</dd>
        </dl>
      </header>

      <div className="sheet-parties">
        <div className="to">
          <p className="client-name">{client.name} {client.honorific}</p>
          {invoice.siteName && <p>現場: {invoice.siteName}</p>}
          <p className="lead">下記の通りご請求申し上げます。</p>
          <table className="total-box">
            <tbody>
              <tr><th>ご請求金額(税込)</th><td>¥{yen(invoice.total)}-</td></tr>
            </tbody>
          </table>
          <p>対象期間: {jpDate(invoice.period.from)} 〜 {jpDate(invoice.period.to)}</p>
          <p>お支払期限: {jpDate(invoice.dueDate)}</p>
        </div>
        <div className="from">
          <p className="company-name">{company.name}</p>
          {company.postalCode && <p>〒{company.postalCode}</p>}
          <p>{company.address}</p>
          {company.tel && <p>TEL {company.tel}</p>}
          {company.registrationNo && <p>登録番号: {company.registrationNo}</p>}
        </div>
      </div>

      <table className="lines">
        <thead>
          <tr><th>現場</th><th>摘要</th><th>数量</th><th>単位</th><th>単価</th><th>金額</th></tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.siteName}</td>
              <td>{l.description}{l.taxRate === 0 && ' ※'}</td>
              <td className="num">{l.quantity.toLocaleString('ja-JP')}</td>
              <td>{l.unit}</td>
              <td className="num">{yen(l.unitPrice)}</td>
              <td className="num">{yen(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals">
        <tbody>
          {invoice.taxSummaries.map((t) =>
            t.taxRate === 0 ? (
              <tr key={t.taxRate}><th>対象外(※)</th><td className="num">{yen(t.subtotal)}</td></tr>
            ) : (
              <tr key={t.taxRate}>
                <th>{t.taxRate}%対象 {yen(t.subtotal)} / 消費税</th>
                <td className="num">{yen(t.tax)}</td>
              </tr>
            ),
          )}
          <tr><th>小計(税抜)</th><td className="num">{yen(invoice.subtotal)}</td></tr>
          <tr><th>消費税</th><td className="num">{yen(invoice.tax)}</td></tr>
          <tr className="grand"><th>合計</th><td className="num">{yen(invoice.total)}</td></tr>
        </tbody>
      </table>

      {company.bankInfo && (
        <div className="bank">
          <h3>お振込先</h3>
          <p>{company.bankInfo}</p>
        </div>
      )}
    </article>
  )
}
