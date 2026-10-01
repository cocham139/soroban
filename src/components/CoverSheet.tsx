import type { Company, Invoice } from '../types'
import { jpDate, yen } from '../lib/format'

interface Props {
  invoice: Invoice
  company: Company
  issueDate: string
  note: string
}

/** 請求書の表紙(A4横)。現場ごとに1行、経費は行を追加 */
export default function CoverSheet({ invoice, company, issueDate, note }: Props) {
  const { client } = invoice
  const hasExempt = invoice.coverLines.some((l) => l.taxRate === 0)
  return (
    <article className="sheet cover">
      <header className="cover-head">
        <h2>{invoice.isExpenseOnly ? '請 求 書(経費)' : '請　求　書'}</h2>
        <dl className="cover-meta">
          <dt>発行日</dt><dd>{jpDate(issueDate)}</dd>
          <dt>請求書番号</dt><dd>{invoice.number}</dd>
        </dl>
      </header>

      <div className="cover-parties">
        <div className="to">
          <p className="client-name">{client.name}<span>{client.honorific}</span></p>
          <p className="lead">下記の通りご請求申し上げます。</p>
          <table className="total-box">
            <tbody>
              <tr><th>請求金額</th><td>¥{yen(invoice.total)}</td></tr>
            </tbody>
          </table>
          <p className="small">
            対象期間 {jpDate(invoice.period.from)}〜{jpDate(invoice.period.to)} / お支払期限 {jpDate(invoice.dueDate)}
          </p>
        </div>
        <div className="from">
          <p className="company-name">{company.name}</p>
          {company.postalCode && <p>〒{company.postalCode}</p>}
          <p>{company.address}</p>
          {company.tel && <p>TEL:{company.tel}</p>}
          {company.fax && <p>FAX:{company.fax}</p>}
          {company.registrationNo && <p>登録番号 {company.registrationNo}</p>}
        </div>
      </div>

      <table className="cover-lines">
        <thead>
          <tr><th>現　場　名</th><th>仕様</th><th>数量</th><th>単位</th><th>単価</th><th>今月請求額</th><th>消費税</th></tr>
        </thead>
        <tbody>
          {invoice.coverLines.map((l, i) => (
            <tr key={i}>
              <td className="site">{l.name}{l.taxRate === 0 && ' ※'}</td>
              <td>{l.spec}</td>
              <td className="num">{l.quantity}</td>
              <td className="center">{l.unit}</td>
              <td className="num">{yen(l.unitPrice)}</td>
              <td className="num">{yen(l.amount)}</td>
              <td className="num">{l.taxRate === 0 ? '−' : yen(l.tax)}</td>
            </tr>
          ))}
          <tr className="subtotal">
            <th colSpan={5}>小　　計</th>
            <td className="num">{yen(invoice.subtotal)}</td>
            <td className="num">{yen(invoice.tax)}</td>
          </tr>
          <tr className="grand">
            <th colSpan={5}>合　　計</th>
            <td className="num" colSpan={2}>{yen(invoice.total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="small tax-note">
        {invoice.taxSummaries
          .map((t) => (t.taxRate === 0 ? `対象外(※) ${yen(t.subtotal)}円` : `${t.taxRate}%対象 ${yen(t.subtotal)}円 消費税 ${yen(t.tax)}円`))
          .join(' / ')}
        {hasExempt && '(※は消費税の対象外)'}
      </p>

      <div className="cover-foot">
        {company.bankInfo && <p className="bank">振込先:{company.bankInfo}</p>}
        <div className="remarks">
          <p>＜備考＞</p>
          <p className="remarks-body">{note}</p>
        </div>
      </div>
    </article>
  )
}
