import type {
  Breakdown,
  BreakdownColumn,
  BreakdownRow,
  Client,
  CoverLine,
  EquipmentRecord,
  ExpenseLine,
  Invoice,
  Issue,
  Masters,
  Rate,
  RoundingMode,
  TaxRate,
  TaxSummary,
  WorkRecord,
} from '../types'
import { billingPeriod, dueDate } from './period'
import { formatHours, splitDayNight } from './time'

export const CONSUMPTION_TAX_RATE: TaxRate = 10
export const DEFAULT_SPEC = '作業一式'

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

/** 内訳の金額は1円未満を四捨五入する */
const yen = (numerator: number, denominator: number) => roundDiv(numerator, denominator, 'round')

/** 現場指定の単価を優先し、なければ元請け共通(現場ID空欄)の単価を使う */
function findBySite<T extends { clientId: string; siteId: string }>(
  list: T[],
  clientId: string,
  siteId: string,
  match: (x: T) => boolean,
): T | undefined {
  return (
    list.find((x) => x.clientId === clientId && x.siteId === siteId && match(x)) ??
    list.find((x) => x.clientId === clientId && x.siteId === '' && match(x))
  )
}

export function findRate(rates: Rate[], clientId: string, siteId: string, jobType: string) {
  return findBySite(rates, clientId, siteId, (r) => r.jobType === jobType)
}

/** 税率ごとに小計を出し、消費税は請求書1枚につき税率ごとに1回だけ端数処理する(インボイス制度) */
export function summarizeTax(lines: { amount: number; taxRate: TaxRate }[], rounding: RoundingMode): TaxSummary[] {
  const byRate = new Map<TaxRate, number>()
  for (const l of lines) byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + l.amount)
  return [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([taxRate, subtotal]) => ({ taxRate, subtotal, tax: roundDiv(subtotal * taxRate, 100, rounding) }))
}

/**
 * 表紙の行ごとの消費税欄を埋める。行ごとに切り捨てた額を出し、
 * 請求書単位の消費税との差(端数)は金額が最も大きい行に寄せる。合計は必ず請求書単位の消費税と一致する。
 */
export function allocateTax(lines: CoverLine[], summaries: TaxSummary[]): CoverLine[] {
  const result = lines.map((l) => ({ ...l, tax: Math.floor((l.amount * l.taxRate) / 100) }))
  for (const s of summaries) {
    const same = result.filter((l) => l.taxRate === s.taxRate)
    if (same.length === 0) continue
    const diff = s.tax - same.reduce((sum, l) => sum + l.tax, 0)
    const largest = same.reduce((a, b) => (b.amount > a.amount ? b : a))
    largest.tax += diff
  }
  return result
}

const isNight = (shiftType: string) => shiftType.includes('夜')

interface RowAcc {
  row: BreakdownRow
  /** 時間単価の列は分で集計し、最後に時間に直す */
  minutes: Record<string, number>
}

function rowKey(date: string, work: string, time: string) {
  return [date, work, time].join('\u0000')
}

/** 現場 × 職種 の実績から内訳書を作る(機材は呼び出し側で追加する) */
function personBreakdown(
  records: WorkRecord[],
  client: Client,
  rate: Rate,
  title: string,
  issues: Issue[],
): { breakdown: Breakdown; rows: Map<string, RowAcc> } {
  const hourly = client.billingMethod === 'hourly'
  const prorate = !hourly && client.ninkuMode === 'prorate'
  const columns: BreakdownColumn[] = hourly
    ? [
        { key: 'day', label: '日勤', unit: '時間', unitPrice: rate.dayPrice },
        { key: 'night', label: '夜勤', unit: '時間', unitPrice: rate.nightPrice },
      ]
    : [
        { key: 'day', label: '日勤', unit: '人工', unitPrice: rate.dayPrice },
        { key: 'night', label: '夜勤', unit: '人工', unitPrice: rate.nightPrice },
        { key: 'overtime', label: '残業', unit: '時間', unitPrice: rate.overtimeHourly },
      ]

  const rows = new Map<string, RowAcc>()
  let overtimeWithoutRate = 0
  const mismatched: string[] = []
  for (const r of records) {
    const time = `${r.start}-${r.end}`
    const key = rowKey(r.date, r.work, time)
    let acc = rows.get(key)
    if (!acc) {
      acc = { row: { date: r.date, work: r.work, time, quantities: {}, amounts: {}, amount: 0 }, minutes: {} }
      rows.set(key, acc)
    }
    const add = (k: string, n: number) => (acc!.minutes[k] = (acc!.minutes[k] ?? 0) + n)

    if (hourly) {
      const split = splitDayNight(r.start, r.end, r.breakMinutes, client.nightStart, client.nightEnd)
      // 実働分を正とし、計算上の日勤分を超えた分を夜勤とする
      const day = Math.min(split.day, r.workMinutes)
      if (split.day + split.night !== r.workMinutes) mismatched.push(r.id)
      add('day', day)
      add('night', r.workMinutes - day)
    } else {
      const regular = r.workMinutes - r.overtimeMinutes
      const k = isNight(r.shiftType) ? 'night' : 'day'
      // 人工は「1日1人工」なら1人、按分なら所定内実働の分(あとで所定実働で割る)
      add(k, prorate ? regular : 1)
      add('overtime', r.overtimeMinutes)
      if (r.overtimeMinutes > 0 && rate.overtimeHourly <= 0) overtimeWithoutRate += r.overtimeMinutes
    }
  }
  if (mismatched.length > 0) {
    issues.push({
      level: 'warn',
      message: `${client.name} ${title}: 実働分が開始・終了・休憩から計算した時間と合わない実績が ${mismatched.length} 件あります(${mismatched.slice(0, 3).join('、')}${mismatched.length > 3 ? ' ほか' : ''})。実働分を正として計算しています`,
    })
  }
  if (overtimeWithoutRate > 0) {
    issues.push({
      level: 'warn',
      message: `${client.name} ${title}: 残業 ${formatHours(overtimeWithoutRate)} 時間がありますが、残業単価が未設定です`,
    })
  }

  // 集計値をこの数で割ると数量になる(時間 = 分 ÷ 60、按分の人工 = 分 ÷ 所定実働、1日1人工 = 人数 ÷ 1)
  const unitMinutes = (c: BreakdownColumn) => (c.unit !== '人工' ? 60 : prorate ? client.standardMinutes : 1)
  for (const acc of rows.values()) {
    for (const c of columns) {
      const m = acc.minutes[c.key] ?? 0
      if (m === 0) continue
      const amount = yen(m * c.unitPrice, unitMinutes(c))
      acc.row.quantities[c.key] = Math.round((m / unitMinutes(c)) * 100) / 100
      acc.row.amounts[c.key] = amount
      acc.row.amount += amount
    }
  }
  return { breakdown: { siteId: '', title, columns, rows: [], totals: {}, amount: 0 }, rows }
}

function finishBreakdown(b: Breakdown, rows: Map<string, RowAcc>, keepColumns: string[]): Breakdown {
  const sorted = [...rows.values()]
    .map((a) => a.row)
    .sort((x, y) => x.date.localeCompare(y.date) || x.time.localeCompare(y.time) || x.work.localeCompare(y.work, 'ja'))
  const totals: Record<string, number> = {}
  for (const r of sorted) {
    for (const [k, v] of Object.entries(r.quantities)) totals[k] = Math.round(((totals[k] ?? 0) + v) * 100) / 100
  }
  return {
    ...b,
    rows: sorted,
    totals,
    // 日勤・夜勤など基本の列は常に出し、ほかは数量がある列だけ出す
    columns: b.columns.filter((c) => keepColumns.includes(c.key) || (totals[c.key] ?? 0) > 0),
    amount: sorted.reduce((s, r) => s + r.amount, 0),
  }
}

/** 1つの請求書(元請け、または元請け × 現場)に載る内訳書と表紙の行を作る */
function buildBody(
  records: WorkRecord[],
  equipment: EquipmentRecord[],
  client: Client,
  masters: Masters,
  issues: Issue[],
): { breakdowns: Breakdown[]; coverLines: CoverLine[] } {
  const siteIds = [...new Set([...records.map((r) => r.siteId), ...equipment.map((e) => e.siteId)])].sort()
  const breakdowns: Breakdown[] = []
  const coverLines: CoverLine[] = []

  for (const siteId of siteIds) {
    const siteRecords = records.filter((r) => r.siteId === siteId)
    const siteEquipment = equipment.filter((e) => e.siteId === siteId)
    const site = masters.sites.find((s) => s.clientId === client.id && s.siteId === siteId)
    const siteName = siteRecords[0]?.siteName ?? siteId
    const coverName = site?.coverName.trim() || siteName
    const baseTitle = coverName.replace(/\s*\n\s*/g, ' ')

    // 職種ごとに内訳書を分ける。人数の多い職種を先に(1枚目は職種名を付けない)
    const byJob = new Map<string, WorkRecord[]>()
    for (const r of siteRecords) byJob.set(r.jobType, [...(byJob.get(r.jobType) ?? []), r])
    const jobs = [...byJob.entries()].sort((a, b) => b[1].length - a[1].length)

    const parts: { breakdown: Breakdown; rows: Map<string, RowAcc>; keep: string[] }[] = []
    jobs.forEach(([jobType, list], i) => {
      const title = i === 0 || !jobType ? baseTitle : `${baseTitle}(${jobType})`
      const rate = findRate(masters.rates, client.id, siteId, jobType)
      if (!rate) {
        issues.push({
          level: 'error',
          message: `${client.name} ${siteName} 職種「${jobType || '(空欄)'}」: 単価が未登録のため ${list.length} 件を請求書に載せていません`,
        })
        return
      }
      const p = personBreakdown(list, client, rate, title, issues)
      parts.push({ ...p, breakdown: { ...p.breakdown, siteId }, keep: ['day', 'night'] })
    })

    if (siteEquipment.length > 0) {
      // 機材は1枚目の内訳書に、同じ日・同じ作業内容の行があればその行に載せる
      if (parts.length === 0) {
        parts.push({
          breakdown: { siteId, title: baseTitle, columns: [], rows: [], totals: {}, amount: 0 },
          rows: new Map(),
          keep: [],
        })
      }
      const target = parts[0]
      const itemColumns = new Map<string, BreakdownColumn>()
      for (const e of siteEquipment) {
        const price = findBySite(masters.equipmentRates, client.id, siteId, (x) => x.item === e.item)
        if (!price) continue
        const key = `eq:${e.item}`
        if (!itemColumns.has(key)) itemColumns.set(key, { key, label: e.item, unit: '台', unitPrice: price.unitPrice })
        const acc =
          [...target.rows.values()].find((a) => a.row.date === e.date && a.row.work === e.work) ??
          (() => {
            const created: RowAcc = { row: { date: e.date, work: e.work, time: '', quantities: {}, amounts: {}, amount: 0 }, minutes: {} }
            target.rows.set(rowKey(e.date, e.work, ''), created)
            return created
          })()
        acc.row.quantities[key] = (acc.row.quantities[key] ?? 0) + e.quantity
        acc.row.amounts[key] = (acc.row.amounts[key] ?? 0) + e.quantity * price.unitPrice
        acc.row.amount += e.quantity * price.unitPrice
      }
      const missing = [...new Set(siteEquipment.map((e) => e.item))].filter(
        (item) => !findBySite(masters.equipmentRates, client.id, siteId, (x) => x.item === item),
      )
      for (const item of missing) {
        issues.push({
          level: 'error',
          message: `${client.name} ${siteName} 機材「${item}」: 単価が未登録のため請求書に載せていません`,
        })
      }
      target.breakdown = { ...target.breakdown, columns: [...target.breakdown.columns, ...itemColumns.values()] }
    }

    const finished = parts.map((p) => finishBreakdown(p.breakdown, p.rows, p.keep)).filter((b) => b.rows.length > 0)
    if (finished.length === 0) continue
    breakdowns.push(...finished)
    const amount = finished.reduce((s, b) => s + b.amount, 0)
    coverLines.push({
      siteId,
      name: coverName,
      spec: site?.spec.trim() || DEFAULT_SPEC,
      quantity: 1,
      unit: '式',
      unitPrice: amount,
      amount,
      taxRate: CONSUMPTION_TAX_RATE,
      tax: 0,
    })
  }
  return { breakdowns, coverLines }
}

function expenseLine(e: ExpenseLine): CoverLine {
  return {
    siteId: null,
    name: e.description,
    spec: '',
    quantity: 1,
    unit: '式',
    unitPrice: e.amount,
    amount: e.amount,
    taxRate: e.taxRate,
    tax: 0,
  }
}

type Draft = Omit<Invoice, 'taxSummaries' | 'subtotal' | 'tax' | 'total'>

function finalize(base: Draft, rounding: RoundingMode): Invoice {
  const taxSummaries = summarizeTax(base.coverLines, rounding)
  const subtotal = taxSummaries.reduce((s, t) => s + t.subtotal, 0)
  const tax = taxSummaries.reduce((s, t) => s + t.tax, 0)
  return {
    ...base,
    coverLines: allocateTax(base.coverLines, taxSummaries),
    taxSummaries,
    subtotal,
    tax,
    total: subtotal + tax,
  }
}

export interface BuildResult {
  invoices: Invoice[]
  issues: Issue[]
}

/**
 * 請求月(YYYY-MM)の請求書を作る。
 * 元請けごとの締め日で集計期間を決め、その期間の実績・機材だけを対象にする。
 * expenses は請求書番号(本体)をキーにした手入力の経費行。
 */
export function buildInvoices(
  records: WorkRecord[],
  equipment: EquipmentRecord[],
  masters: Masters,
  month: string,
  expenses: Record<string, ExpenseLine[]>,
): BuildResult {
  const issues: Issue[] = []
  const invoices: Invoice[] = []
  const yyyymm = month.replace('-', '')
  const rounding = masters.company.taxRounding

  const seenIds = new Set<string>()
  for (const c of masters.clients) {
    if (seenIds.has(c.id)) issues.push({ level: 'error', message: `元請けID ${c.id} がマスタに重複して登録されています` })
    seenIds.add(c.id)
  }
  const unknown = new Map<string, { name: string; count: number }>()
  for (const r of [...records, ...equipment]) {
    if (seenIds.has(r.clientId)) continue
    const u = unknown.get(r.clientId) ?? { name: 'clientName' in r ? r.clientName : '', count: 0 }
    u.count++
    unknown.set(r.clientId, u)
  }
  for (const [id, u] of unknown) {
    issues.push({
      level: 'error',
      message: `元請け ${id}${u.name ? `(${u.name})` : ''}がマスタに未登録のため、${u.count} 件の実績・機材を請求できません`,
    })
  }

  for (const client of masters.clients) {
    if (client.billingMethod === 'ninku' && client.ninkuMode === 'prorate' && !(client.standardMinutes > 0)) {
      issues.push({ level: 'error', message: `${client.name}: 按分の所定実働分が未設定のため、請求書を作れません` })
      continue
    }
    const period = billingPeriod(month, client.closingDay)
    const due = dueDate(month, client.paymentMonthOffset, client.paymentDay)
    const inPeriod = (x: { clientId: string; date: string }) =>
      x.clientId === client.id && x.date >= period.from && x.date <= period.to
    const targetRecords = records.filter(inPeriod)
    const targetEquipment = equipment.filter(inPeriod)

    const buckets: { siteId: string | null; siteName: string | null }[] =
      client.invoiceUnit === 'site'
        ? [...new Set([...targetRecords, ...targetEquipment].map((x) => x.siteId))].sort().map((siteId) => ({
            siteId,
            siteName: targetRecords.find((r) => r.siteId === siteId)?.siteName ?? siteId,
          }))
        : targetRecords.length + targetEquipment.length > 0
          ? [{ siteId: null, siteName: null }]
          : []

    for (const bucket of buckets) {
      const inBucket = (x: { siteId: string }) => bucket.siteId === null || x.siteId === bucket.siteId
      const bucketRecords = targetRecords.filter(inBucket)
      const bucketEquipment = targetEquipment.filter(inBucket)
      const number = `${yyyymm}-${client.id}${bucket.siteId ? `-${bucket.siteId}` : ''}`

      const unconfirmed = bucketRecords.filter((r) => !r.confirmed).length
      const noSlip = bucketRecords.filter((r) => !r.slipNo).length
      if (unconfirmed > 0) issues.push({ level: 'warn', message: `${number}: 未確定の実績が ${unconfirmed} 件含まれています` })
      if (noSlip > 0) issues.push({ level: 'warn', message: `${number}: 伝票番号が空の実績が ${noSlip} 件含まれています` })

      const { breakdowns, coverLines } = buildBody(bucketRecords, bucketEquipment, client, masters, issues)
      const expenseLines = (expenses[number] ?? []).map(expenseLine)
      const common = { client, siteName: bucket.siteName, period, dueDate: due, expenseKey: number }

      if (client.expenseMode === 'separate') {
        invoices.push(
          finalize({ ...common, number, isExpenseOnly: false, coverLines, breakdowns, recordCount: bucketRecords.length }, rounding),
        )
        if (expenseLines.length > 0) {
          invoices.push(
            finalize(
              { ...common, number: `${number}-E`, isExpenseOnly: true, coverLines: expenseLines, breakdowns: [], recordCount: 0 },
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
              coverLines: [...coverLines, ...expenseLines],
              breakdowns,
              recordCount: bucketRecords.length,
            },
            rounding,
          ),
        )
      }
    }
  }
  return { invoices, issues }
}
