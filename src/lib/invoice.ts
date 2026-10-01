import type {
  Client,
  ExpenseLine,
  Invoice,
  InvoiceLine,
  Issue,
  Masters,
  Rate,
  RoundingMode,
  TaxRate,
  TaxSummary,
  WorkRecord,
} from '../types'
import { billingPeriod, dueDate } from './period'

export const CONSUMPTION_TAX_RATE: TaxRate = 10

/** 整数 numerator / denominator を指定の方式で丸める */
export function roundDiv(numerator: number, denominator: number, mode: RoundingMode): number {
  const q = numerator / denominator
  switch (mode) {
    case 'floor':
      return Math.floor(q)
    case 'ceil':
      return Math.ceil(q)
    case 'round':
      return Math.round(q)
  }
}

/** 明細の金額は1円未満を四捨五入する */
const lineAmount = (numerator: number, denominator: number) =>
  roundDiv(numerator, denominator, 'round')

/** 現場指定の単価を優先し、なければ元請け共通の単価を使う */
export function findRate(rates: Rate[], clientId: string, siteId: string, shiftType: string) {
  return (
    rates.find((r) => r.clientId === clientId && r.siteId === siteId && r.shiftType === shiftType) ??
    rates.find((r) => r.clientId === clientId && r.siteId === '' && r.shiftType === shiftType)
  )
}

/** 税率ごとに小計を出し、消費税は請求書1枚につき税率ごとに1回だけ端数処理する(インボイス制度) */
export function summarizeTax(lines: InvoiceLine[], rounding: RoundingMode): TaxSummary[] {
  const byRate = new Map<TaxRate, number>()
  for (const l of lines) byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + l.amount)
  return [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([taxRate, subtotal]) => ({
      taxRate,
      subtotal,
      tax: roundDiv(subtotal * taxRate, 100, rounding),
    }))
}

interface Group {
  siteId: string
  siteName: string
  shiftType: string
  holiday: boolean
  records: WorkRecord[]
}

function groupRecords(records: WorkRecord[]): Group[] {
  const groups = new Map<string, Group>()
  for (const r of records) {
    const key = [r.siteId, r.shiftType, r.holiday ? 1 : 0].join('\u0000')
    let g = groups.get(key)
    if (!g) {
      g = { siteId: r.siteId, siteName: r.siteName, shiftType: r.shiftType, holiday: r.holiday, records: [] }
      groups.set(key, g)
    }
    g.records.push(r)
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.siteId.localeCompare(b.siteId) ||
      a.shiftType.localeCompare(b.shiftType, 'ja') ||
      Number(a.holiday) - Number(b.holiday),
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** 現場 × 勤務区分 × 休日 の1グループから明細行(基本・残業・深夜)を作る */
function linesForGroup(g: Group, client: Client, rate: Rate, issues: Issue[]): InvoiceLine[] {
  const sum = (f: (r: WorkRecord) => number) => g.records.reduce((s, r) => s + f(r), 0)
  const regularMinutes = sum((r) => r.workMinutes - r.overtimeMinutes)
  const overtimeMinutes = sum((r) => r.overtimeMinutes)
  const nightMinutes = sum((r) => r.nightMinutes)
  const price = g.holiday && rate.holidayUnitPrice > 0 ? rate.holidayUnitPrice : rate.unitPrice
  const label = `${g.shiftType}${g.holiday ? '(休日)' : ''}`
  const base = { siteName: g.siteName, taxRate: CONSUMPTION_TAX_RATE }
  const lines: InvoiceLine[] = []

  if (client.billingMethod === 'hourly') {
    lines.push({
      ...base,
      description: label,
      quantity: round2(regularMinutes / 60),
      unit: '時間',
      unitPrice: price,
      amount: lineAmount(regularMinutes * price, 60),
    })
  } else if (client.ninkuMode === 'prorate') {
    lines.push({
      ...base,
      description: label,
      quantity: round2(regularMinutes / client.standardMinutes),
      unit: '人工',
      unitPrice: price,
      amount: lineAmount(regularMinutes * price, client.standardMinutes),
    })
  } else {
    lines.push({
      ...base,
      description: label,
      quantity: g.records.length,
      unit: '人工',
      unitPrice: price,
      amount: g.records.length * price,
    })
  }

  if (overtimeMinutes > 0) {
    if (rate.overtimeHourly <= 0) {
      issues.push({
        level: 'warn',
        message: `${client.name} ${g.siteName} ${label}: 残業 ${round2(overtimeMinutes / 60)} 時間がありますが、残業単価が未設定です`,
      })
    } else {
      lines.push({
        ...base,
        description: `${label} 残業`,
        quantity: round2(overtimeMinutes / 60),
        unit: '時間',
        unitPrice: rate.overtimeHourly,
        amount: lineAmount(overtimeMinutes * rate.overtimeHourly, 60),
      })
    }
  }

  if (nightMinutes > 0 && rate.nightAddHourly > 0) {
    lines.push({
      ...base,
      description: `${label} 深夜割増`,
      quantity: round2(nightMinutes / 60),
      unit: '時間',
      unitPrice: rate.nightAddHourly,
      amount: lineAmount(nightMinutes * rate.nightAddHourly, 60),
    })
  }
  return lines
}

function expenseToLine(e: ExpenseLine): InvoiceLine {
  return {
    siteName: '',
    description: e.description,
    quantity: 1,
    unit: '式',
    unitPrice: e.amount,
    amount: e.amount,
    taxRate: e.taxRate,
  }
}

function finalize(
  base: Omit<Invoice, 'taxSummaries' | 'subtotal' | 'tax' | 'total'>,
  rounding: RoundingMode,
): Invoice {
  const taxSummaries = summarizeTax(base.lines, rounding)
  const subtotal = taxSummaries.reduce((s, t) => s + t.subtotal, 0)
  const tax = taxSummaries.reduce((s, t) => s + t.tax, 0)
  return { ...base, taxSummaries, subtotal, tax, total: subtotal + tax }
}

export interface BuildResult {
  invoices: Invoice[]
  issues: Issue[]
}

/**
 * 請求月(YYYY-MM)の請求書を作る。
 * 元請けごとの締め日で集計期間を決め、その期間の実績だけを対象にする。
 * expenses は請求書番号(本体)をキーにした手入力の経費行。
 */
export function buildInvoices(
  records: WorkRecord[],
  masters: Masters,
  month: string,
  expenses: Record<string, ExpenseLine[]>,
): BuildResult {
  const issues: Issue[] = []
  const invoices: Invoice[] = []
  const yyyymm = month.replace('-', '')
  const rounding = masters.company.taxRounding

  const unknownClients = new Map<string, { name: string; count: number }>()
  for (const r of records) {
    if (!masters.clients.some((c) => c.id === r.clientId)) {
      const u = unknownClients.get(r.clientId) ?? { name: r.clientName, count: 0 }
      u.count++
      unknownClients.set(r.clientId, u)
    }
  }
  const seenIds = new Set<string>()
  for (const c of masters.clients) {
    if (seenIds.has(c.id)) {
      issues.push({ level: 'error', message: `元請けID ${c.id} がマスタに重複して登録されています` })
    }
    seenIds.add(c.id)
  }
  for (const [id, u] of unknownClients) {
    issues.push({
      level: 'error',
      message: `元請け ${id}(${u.name})がマスタに未登録のため、${u.count} 件の実績を請求できません`,
    })
  }

  for (const client of masters.clients) {
    if (client.billingMethod === 'ninku' && client.ninkuMode === 'prorate' && !(client.standardMinutes > 0)) {
      issues.push({
        level: 'error',
        message: `${client.name}: 按分の所定実働分が未設定のため、請求書を作れません`,
      })
      continue
    }
    const period = billingPeriod(month, client.closingDay)
    const due = dueDate(month, client.paymentMonthOffset, client.paymentDay)
    const target = records.filter(
      (r) => r.clientId === client.id && r.date >= period.from && r.date <= period.to,
    )

    const buckets: { siteId: string | null; siteName: string | null; records: WorkRecord[] }[] = []
    if (client.invoiceUnit === 'site') {
      for (const r of target) {
        let b = buckets.find((x) => x.siteId === r.siteId)
        if (!b) {
          b = { siteId: r.siteId, siteName: r.siteName, records: [] }
          buckets.push(b)
        }
        b.records.push(r)
      }
      buckets.sort((a, b) => a.siteId!.localeCompare(b.siteId!))
    } else if (target.length > 0) {
      buckets.push({ siteId: null, siteName: null, records: target })
    }

    for (const bucket of buckets) {
      const number = `${yyyymm}-${client.id}${bucket.siteId ? `-${bucket.siteId}` : ''}`
      const unconfirmed = bucket.records.filter((r) => !r.confirmed).length
      const noSlip = bucket.records.filter((r) => !r.slipNo).length
      if (unconfirmed > 0) {
        issues.push({ level: 'warn', message: `${number}: 未確定の実績が ${unconfirmed} 件含まれています` })
      }
      if (noSlip > 0) {
        issues.push({ level: 'warn', message: `${number}: 伝票番号が空の実績が ${noSlip} 件含まれています` })
      }
      const lines: InvoiceLine[] = []
      for (const g of groupRecords(bucket.records)) {
        const rate = findRate(masters.rates, client.id, g.siteId, g.shiftType)
        if (!rate) {
          issues.push({
            level: 'error',
            message: `${client.name} ${g.siteName} ${g.shiftType}: 単価が未登録のため ${g.records.length} 件を請求書に載せていません`,
          })
          continue
        }
        lines.push(...linesForGroup(g, client, rate, issues))
      }

      const expenseLines = (expenses[number] ?? []).map(expenseToLine)
      const common = {
        client,
        siteName: bucket.siteName,
        period,
        dueDate: due,
        expenseKey: number,
      }
      if (client.expenseMode === 'separate') {
        invoices.push(
          finalize({ ...common, number, isExpenseOnly: false, lines, recordCount: bucket.records.length }, rounding),
        )
        if (expenseLines.length > 0) {
          invoices.push(
            finalize(
              { ...common, number: `${number}-E`, isExpenseOnly: true, lines: expenseLines, recordCount: 0 },
              rounding,
            ),
          )
        }
      } else {
        invoices.push(
          finalize(
            {
              ...common,
              number,
              isExpenseOnly: false,
              lines: [...lines, ...expenseLines],
              recordCount: bucket.records.length,
            },
            rounding,
          ),
        )
      }
    }
  }
  return { invoices, issues }
}
