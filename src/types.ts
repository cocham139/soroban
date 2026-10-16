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
  /** csv = 機材明細CSVから / manual = SOLOBANで手入力 */
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

/**
 * 単価の単位
 * standard = 元請けの計算方式に従う(時間単価なら延べ時間、人工なら人数)
 * visit    = 1回いくら(内訳書の1行 = 同じ日・同じ作業・同じ時間 を1回と数える。例: 規制1回)
 * monthly  = 月いくら(請求書ごとに1式。人数や回数に関係なく同じ額)
 */
export type PriceUnit = 'standard' | 'visit' | 'monthly'
/**
 * 1回いくらのときの人の分
 * none     = 1回の料金だけ(人数・時間は請求しない)
 * plus     = 1回の料金 + 人の分(元請けの計算方式で、日勤・夜勤の単価を使う)
 * included = 決まった人数までは1回の料金に込み、超えた人数は1人いくらで追加
 */
export type VisitPeople = 'none' | 'plus' | 'included'
/** 1回いくらの数え方: row = 内訳書の1行(同じ日・同じ作業・同じ時間)ごとに1 / day = 1日ごとに1(同じ日の作業はまとめて1) */
export type VisitCount = 'row' | 'day'

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
  /** 単価の単位(既定は元請けの計算方式) */
  priceUnit: PriceUnit
  /** 1回いくらのときの呼び方(内訳書の列名。例: 規制) */
  visitLabel: string
  /** 1回いくらの単位の呼び方(自由入力。回・日・現場 など。内訳書の数量の単位になる) */
  visitUnit: string
  /** 1回いくらの数え方 */
  visitCount: VisitCount
  /** 1回いくら: 昼の1回の単価 */
  visitDayPrice: number
  /** 1回いくら: 夜の1回の単価 */
  visitNightPrice: number
  /** 1回いくらのときの人の分 */
  visitPeople: VisitPeople
  /** 人数込みのとき、1回の料金に含まれる人数 */
  includedPeople: number
  /** 人数込みのとき、超えた1人あたりの追加料金(1回ごと) */
  extraPersonPrice: number
  /** 月いくら: 月額 */
  monthlyPrice: number
  /** 月いくらの単位の呼び方(自由入力。式・月 など) */
  monthlyUnit: string
}

/**
 * 見積書の品目の数え方
 * personHours = 延べ時間(人 × 時間) / persons = 人数(人・日) / row = 1作業ごとに1 / day = 1日ごとに1 / month = 請求書ごとに1
 */
export type ItemBasis = 'personHours' | 'persons' | 'row' | 'day' | 'month'

/** 見積書の品目(元請け × 現場 ごとの単価表)。見積書がある元請け・現場は、人の単価の代わりにこれで請求する */
export interface QuoteItem {
  id: string
  clientId: string
  /** 空文字 = その元請けの全現場 */
  siteId: string
  /** 見積書の品目名(例: 一般道 片側交互通行規制(昼間)×Ⅱ うち切替1回) */
  name: string
  /** 単位(自由入力。h・人・日・回・台・月 など) */
  unit: string
  unitPrice: number
  basis: ItemBasis
  /** 見積書の数量(0 = なし)。使った量との比較に使う */
  quantity: number
  /** 見積書にない品目として請求の途中で足したもの(追加の見積書が必要) */
  needsQuote: boolean
}

/** 対応づけ: SHIRUBEの実績(元請け × 現場 × 職種 × 作業名)を見積書の品目に結びつける。空文字は「どれでも」 */
export interface ItemRule {
  id: string
  clientId: string
  siteId: string
  jobType: string
  work: string
  /** 昼の品目(夜の品目がなければ夜もこれ) */
  dayItemId: string
  /** 夜の品目(空 = 昼の品目と同じ) */
  nightItemId: string
}

/** 内訳書の行ごとに指定した品目(行のキー → 品目ID)。対応づけより優先する */
export type ItemOverrides = Record<string, string>

/** 品目の割り当て待ち(対応づけがない実績のまとまり) */
export interface Unassigned {
  clientId: string
  clientName: string
  siteId: string
  siteName: string
  jobType: string
  work: string
  /** 夜の行を含むか */
  hasNight: boolean
  /** 該当する内訳書の行数 */
  rows: number
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
  /** 見積書の品目 */
  quoteItems: QuoteItem[]
  /** 実績と品目の対応づけ */
  itemRules: ItemRule[]
}

export type TaxRate = 10 | 0

/** 請求書に手で足す行(経費・その他の請求)。数量 × 単価 = 金額(以前の版の行は数量・単位・単価がなく、金額だけ) */
export interface ExpenseLine {
  id: string
  description: string
  amount: number
  taxRate: TaxRate
  quantity?: number
  /** 単位は自由入力(式・回・人・日 など) */
  unit?: string
  unitPrice?: number
}

/** 内訳書の数量の列(日勤・夜勤・残業・機材ごと) */
export interface BreakdownColumn {
  key: string
  label: string
  /** 時間・人工・台・人のほか、1回いくら・月いくらは自由入力の呼び方(回・日・式 など) */
  unit: string
  unitPrice: number
}

export interface BreakdownRow {
  date: string
  work: string
  time: string
  /** 品目の明細形式の行(見積書で請求するとき): 品目名・単位・数量・単価 */
  item?: { name: string; unit: string; quantity: number; unitPrice: number; needsQuote: boolean }
  /** 行ごとの品目の指定に使うキー(見積書で請求するとき) */
  key?: string
  /** 列キー → 数量 */
  quantities: Record<string, number>
  /** 列キー → 金額 */
  amounts: Record<string, number>
  amount: number
}

/** 内訳書1枚分(現場 × 職種) */
export interface Breakdown {
  /** columns = 日勤・夜勤などの列に数量を並べる / lines = 1行に1品目(見積書の品目で請求するとき) */
  layout?: 'columns' | 'lines'
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
  /** 品目の割り当て待ちがある(請求書は下書き) */
  unassigned: Unassigned[]
}

export interface Issue {
  level: 'error' | 'warn' | 'info'
  message: string
}
