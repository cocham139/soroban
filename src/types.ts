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
  /** 規制保安員 / 作業員 など。単価と内訳書を分ける単位 */
  jobType: string
  /** その日の工事名(内訳書の「工事名」欄。SHIRUBEで空なら現場名) */
  work: string
  shiftType: string // 日勤 / 夜勤
  start: string // HH:MM
  end: string // HH:MM(開始より前なら翌日)
  breakMinutes: number
  /** 総実働(残業を含む) */
  workMinutes: number
  /** 総実働のうち残業 */
  overtimeMinutes: number
  slipNo: string
  confirmed: boolean
}

/** SHIRUBE 機材明細CSVの1行(車両・規制材など、日ごとの台数) */
export interface EquipmentRecord {
  id: string
  date: string
  clientId: string
  siteId: string
  work: string
  item: string
  quantity: number
  slipNo: string
  /** csv = 機材明細CSVから / manual = SOROBANで手入力 */
  source: 'csv' | 'manual'
}

export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface Company {
  name: string
  postalCode: string
  address: string
  tel: string
  fax: string
  /** 適格請求書発行事業者の登録番号(T + 13桁) */
  registrationNo: string
  bankInfo: string
  taxRounding: RoundingMode
}

/** ninku = 人工(人数)で請求 / hourly = 延べ時間で請求 */
export type BillingMethod = 'ninku' | 'hourly'
/**
 * 昼夜の分け方
 * band  = 時間帯で分ける(時間単価なら1人の勤務を昼・夜の時間に分割、人工なら長いほうの時間帯)
 * shift = 実績の勤務区分に従う(夜勤なら全時間を夜間単価。「夜間1名」の受注で17:00開始でも夜間単価、など)
 */
export type DayNightRule = 'band' | 'shift'
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
  /** 昼夜の分け方 */
  dayNightRule: DayNightRule
  /** 昼夜を時間帯で分けるときの夜間帯(HH:MM、終了が開始より前なら翌日まで) */
  nightStart: string
  nightEnd: string
  /** 締め日。0 = 末日 */
  closingDay: number
  /** 支払月: 締め日の何か月後か */
  paymentMonthOffset: number
  /** 支払日。0 = 末日 */
  paymentDay: number
  invoiceUnit: 'client' | 'site'
  expenseMode: 'include' | 'separate'
}

/** 表紙に載せる現場の情報 */
export interface Site {
  clientId: string
  siteId: string
  /** 表紙の現場名(改行可)。空ならCSVの現場名 */
  coverName: string
  /** 表紙の「仕様」欄 */
  spec: string
  /** 昼夜の分け方を元請けの設定から変える場合に指定(空 = 元請けの設定) */
  dayNightRule: DayNightRule | ''
}

/** 人の単価(元請け × 現場 × 職種) */
export interface Rate {
  id: string
  clientId: string
  /** 空文字 = その元請けの全現場に適用 */
  siteId: string
  jobType: string
  /** 時間単価なら日勤の時間単価、人工なら日勤の人工単価 */
  dayPrice: number
  /** 時間単価なら夜勤の時間単価、人工なら夜勤の人工単価 */
  nightPrice: number
  /** 人工のときの残業時間単価 */
  overtimeHourly: number
}

/** 機材・車両の単価(元請け × 現場 × 品目、1日1台あたり) */
export interface EquipmentRate {
  id: string
  clientId: string
  siteId: string
  item: string
  unitPrice: number
}

export interface Masters {
  version: 2
  company: Company
  clients: Client[]
  sites: Site[]
  rates: Rate[]
  equipmentRates: EquipmentRate[]
}

export type TaxRate = 10 | 0

export interface ExpenseLine {
  id: string
  description: string
  amount: number
  taxRate: TaxRate
}

/** 内訳書の数量の列(日勤・夜勤・残業・機材ごと) */
export interface BreakdownColumn {
  key: string
  label: string
  unit: '時間' | '人工' | '台'
  unitPrice: number
}

export interface BreakdownRow {
  date: string
  work: string
  time: string
  /** 列キー → 数量 */
  quantities: Record<string, number>
  /** 列キー → 金額 */
  amounts: Record<string, number>
  amount: number
}

/** 内訳書1枚分(現場 × 職種) */
export interface Breakdown {
  siteId: string
  title: string
  columns: BreakdownColumn[]
  rows: BreakdownRow[]
  totals: Record<string, number>
  amount: number
}

/** 表紙の明細行 */
export interface CoverLine {
  siteId: string | null
  name: string
  spec: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
  taxRate: TaxRate
  /** 表示用に配分した消費税(合計は請求書単位の消費税と一致する) */
  tax: number
}

export interface TaxSummary {
  taxRate: TaxRate
  subtotal: number
  tax: number
}

export interface Invoice {
  number: string
  /** 経費・備考を紐づけるキー(経費を別請求にした場合も本体の請求書番号) */
  expenseKey: string
  isExpenseOnly: boolean
  client: Client
  siteName: string | null
  period: { from: string; to: string }
  dueDate: string
  coverLines: CoverLine[]
  breakdowns: Breakdown[]
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
