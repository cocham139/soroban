import type { Invoice } from '../types'
import { toCsv } from './csv'

export const INVOICE_CSV_HEADER = [
  '請求書番号',
  '発行日',
  '元請けID',
  '元請け名',
  '対象期間開始',
  '対象期間終了',
  '支払期限',
  '現場名',
  '摘要',
  '数量',
  '単位',
  '単価',
  '金額',
  '税率',
] as const

/** 請求明細CSV。1行 = 請求書の明細1行。会計ソフト向け変換の元データにもなる */
export function invoicesToCsv(invoices: Invoice[], issueDate: string): string {
  const rows: (string | number)[][] = [[...INVOICE_CSV_HEADER]]
  for (const inv of invoices) {
    for (const l of inv.lines) {
      rows.push([
        inv.number,
        issueDate,
        inv.client.id,
        inv.client.name,
        inv.period.from,
        inv.period.to,
        inv.dueDate,
        l.siteName,
        l.description,
        l.quantity,
        l.unit,
        l.unitPrice,
        l.amount,
        `${l.taxRate}%`,
      ])
    }
  }
  return toCsv(rows)
}

export function downloadText(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
