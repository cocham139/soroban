/** SHIRUBE 実績明細CSVの1行(隊員 × 日 × 現場 × ポスト) */
export interface WorkRecord {
  id: string
  date: string // YYYY-MM-DD
  clientId: string
  clientName: string
  siteId: string
  siteName: string
  postId: string
  postName: string
  staffId: string
  staffName: string
  shiftType: string // 日勤 / 夜勤 など
  start: string // HH:MM
  end: string // HH:MM
  breakMinutes: number
  /** 総実働(残業を含む) */
  workMinutes: number
  /** 総実働のうち残業 */
  overtimeMinutes: number
  nightMinutes: number
  holiday: boolean
  slipNo: string
  confirmed: boolean
}

export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface Company {
  name: string
  postalCode: string
  address: string
  tel: string
  /** 適格請求書発行事業者の登録番号(T + 13桁) */
  registrationNo: string
  bankInfo: string
  taxRounding: RoundingMode
}

/** 人工 = 人数(日数)で請求 / hourly = 時間で請求 */
export type BillingMethod = 'ninku' | 'hourly'
/** perDay = 1日1人工 / prorate = 実働時間 ÷ 所定時間 で按分 */
export type NinkuMode = 'perDay' | 'prorate'

export interface Client {
  id: string
  name: string
  honorific: string
  billingMethod: BillingMethod
  ninkuMode: NinkuMode
  /** 按分時の1人工あたりの所定実働分 */
  standardMinutes: number
  /** 締め日。0 = 末日 */
  closingDay: number
  /** 支払月: 締め日の何か月後か */
  paymentMonthOffset: number
  /** 支払日。0 = 末日 */
  paymentDay: number
  invoiceUnit: 'client' | 'site'
  expenseMode: 'include' | 'separate'
}

export interface Rate {
  id: string
  clientId: string
  /** 空文字 = その元請けの全現場に適用 */
  siteId: string
  shiftType: string
  /** 人工単価 または 時間単価(元請けの計算方式による) */
  unitPrice: number
  /** 休日の単価。0 なら通常の単価を使う */
  holidayUnitPrice: number
  overtimeHourly: number
  /** 深夜割増(1時間あたりの加算額)。0 なら割増なし */
  nightAddHourly: number
}

export interface Masters {
  version: 1
  company: Company
  clients: Client[]
  rates: Rate[]
}

export type TaxRate = 10 | 0

export interface ExpenseLine {
  id: string
  description: string
  amount: number
  taxRate: TaxRate
}

export interface InvoiceLine {
  siteName: string
  description: string
  quantity: number
  unit: '人工' | '時間' | '式'
  unitPrice: number
  amount: number
  taxRate: TaxRate
}

export interface TaxSummary {
  taxRate: TaxRate
  subtotal: number
  tax: number
}

export interface Invoice {
  number: string
  /** 経費を紐づけるキー(経費を別請求にした場合も本体の請求書番号) */
  expenseKey: string
  isExpenseOnly: boolean
  client: Client
  siteName: string | null
  period: { from: string; to: string }
  dueDate: string
  lines: InvoiceLine[]
  taxSummaries: TaxSummary[]
  subtotal: number
  tax: number
  total: number
  recordCount: number
}

export interface Issue {
  level: 'error' | 'warn' | 'info'
  message: string
}
