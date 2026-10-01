import { describe, expect, it } from 'vitest'
import type { Client, CoverLine, EquipmentRecord, Masters, Rate, WorkRecord } from '../types'
import { allocateTax, buildInvoices, roundDiv, summarizeTax } from './invoice'
import { emptyMasters, newClient, newEquipmentRate, newSite } from './masters'

let seq = 0
function rec(o: Partial<WorkRecord> = {}): WorkRecord {
  seq++
  return {
    id: `R${seq}`, date: '2026-10-05', clientId: 'C001', clientName: '○○建設',
    siteId: 'S01', siteName: 'Aビル', postId: 'P1', postName: '正門',
    staffId: `E${seq}`, staffName: '山田', jobType: '規制保安員', work: '舗装補修',
    shiftType: '日勤', start: '08:30', end: '17:30', breakMinutes: 60,
    workMinutes: 480, overtimeMinutes: 0, slipNo: 'D-1', confirmed: true,
    ...o,
  }
}
const night = (o: Partial<WorkRecord> = {}) => rec({ shiftType: '夜勤', start: '19:00', end: '04:00', ...o })

function rate(o: Partial<Rate> = {}): Rate {
  return { id: 'rate', clientId: 'C001', siteId: '', jobType: '規制保安員', dayPrice: 3000, nightPrice: 4000, overtimeHourly: 0, ...o }
}

function masters(client: Partial<Client> = {}, rates: Rate[] = [rate()], extra: Partial<Masters> = {}): Masters {
  return { ...emptyMasters(), clients: [{ ...newClient('C001', '○○建設'), ...client }], rates, ...extra }
}

const build = (records: WorkRecord[], m: Masters, equipment: EquipmentRecord[] = [], expenses = {}) =>
  buildInvoices(records, equipment, m, '2026-10', expenses)

describe('roundDiv', () => {
  it('端数処理の方式', () => {
    expect(roundDiv(1999, 10, 'floor')).toBe(199)
    expect(roundDiv(1995, 10, 'round')).toBe(200)
    expect(roundDiv(1991, 10, 'ceil')).toBe(200)
  })
})

describe('消費税', () => {
  const line = (amount: number, taxRate: 10 | 0 = 10): CoverLine => ({
    siteId: null, name: '', spec: '', quantity: 1, unit: '式', unitPrice: amount, amount, taxRate, tax: 0,
  })

  it('税率ごとに合計してから1回だけ端数処理する', () => {
    const lines = [line(1005), line(1005), line(500, 0)]
    expect(summarizeTax(lines, 'floor')).toEqual([
      { taxRate: 10, subtotal: 2010, tax: 201 },
      { taxRate: 0, subtotal: 500, tax: 0 },
    ])
  })

  it('表紙の行ごとの消費税は、合計が請求書単位の消費税と一致するよう端数を寄せる', () => {
    // 行ごとに 10% すると 500.5 + 50.5 + 100 = 651 だが、合計 6510 の 10% = 651
    const lines = [line(5005), line(505), line(1000)]
    const summaries = summarizeTax(lines, 'floor')
    const allocated = allocateTax(lines, summaries)
    expect(allocated.map((l) => l.tax)).toEqual([501, 50, 100])
    expect(allocated.reduce((s, l) => s + l.tax, 0)).toBe(summaries[0].tax)
  })
})

describe('時間単価(日勤帯・夜勤帯)', () => {
  it('同じ日・作業内容・時間の隊員を1行にまとめ、延べ時間 × 単価にする', () => {
    const records = [rec(), rec(), rec(), rec(), night(), night()]
    const { invoices, issues } = build(records, masters())
    expect(issues).toEqual([])
    const [b] = invoices[0].breakdowns
    expect(b.columns.map((c) => c.label)).toEqual(['日勤', '夜勤'])
    expect(b.rows.map((r) => [r.time, r.quantities, r.amount])).toEqual([
      ['08:30-17:30', { day: 32 }, 96000],
      // 19:00〜04:00 休憩60分 → 1人あたり 日勤1時間・夜勤7時間
      ['19:00-04:00', { day: 2, night: 14 }, 6000 + 56000],
    ])
    expect(b.totals).toEqual({ day: 34, night: 14 })
    expect(invoices[0].coverLines).toMatchObject([{ name: 'Aビル', spec: '作業一式', quantity: 1, unit: '式', amount: 158000 }])
    expect(invoices[0].total).toBe(173800)
  })

  it('30分単位の時間も金額は1円単位で正しい', () => {
    const { invoices } = build([rec({ start: '08:00', end: '17:30', workMinutes: 510 })], masters({}, [rate({ dayPrice: 3250 })]))
    expect(invoices[0].breakdowns[0].rows[0]).toMatchObject({ quantities: { day: 8.5 }, amount: 27625 })
  })

  it('実働分が時刻と合わない実績は警告し、実働分を正とする', () => {
    const { invoices, issues } = build([rec({ workMinutes: 420 })], masters())
    expect(issues[0].level).toBe('warn')
    expect(invoices[0].breakdowns[0].rows[0].quantities).toEqual({ day: 7 })
  })

  it('夜勤帯は元請けごとに変えられる', () => {
    const { invoices } = build([night()], masters({ nightStart: '22:00', nightEnd: '05:00' }))
    // 19:00〜22:00 が日勤(3h)、22:00〜04:00 が夜勤(6h)から休憩60分 → 夜勤5h
    expect(invoices[0].breakdowns[0].rows[0].quantities).toEqual({ day: 3, night: 5 })
  })
})

describe('人工', () => {
  it('1日1人工: 勤務区分で日勤・夜勤の人工単価、残業は時間単価', () => {
    const m = masters({ billingMethod: 'ninku' }, [rate({ dayPrice: 18000, nightPrice: 22000, overtimeHourly: 2800 })])
    const records = [rec(), rec({ workMinutes: 570, overtimeMinutes: 90, end: '19:00' }), night()]
    const { invoices, issues } = build(records, m)
    expect(issues).toEqual([])
    const [b] = invoices[0].breakdowns
    expect(b.columns.map((c) => [c.label, c.unit])).toEqual([['日勤', '人工'], ['夜勤', '人工'], ['残業', '時間']])
    expect(b.totals).toEqual({ day: 2, night: 1, overtime: 1.5 })
    expect(b.amount).toBe(36000 + 22000 + 4200)
  })

  it('按分: 所定内実働 ÷ 所定実働', () => {
    const m = masters({ billingMethod: 'ninku', ninkuMode: 'prorate', standardMinutes: 480 }, [rate({ dayPrice: 18000 })])
    const { invoices } = build([rec({ end: '13:30', workMinutes: 240 })], m)
    expect(invoices[0].breakdowns[0].rows[0]).toMatchObject({ quantities: { day: 0.5 }, amount: 9000 })
  })

  it('残業があるのに残業単価が未設定なら警告', () => {
    const m = masters({ billingMethod: 'ninku' }, [rate({ overtimeHourly: 0 })])
    const { issues } = build([rec({ workMinutes: 540, overtimeMinutes: 60, end: '18:30' })], m)
    expect(issues.map((i) => i.level)).toEqual(['warn'])
  })
})

describe('現場・職種・機材', () => {
  it('職種ごとに内訳書を分け、表紙は現場ごとに1行にまとめる', () => {
    const records = [rec(), rec(), rec({ jobType: '作業員' })]
    const m = masters({}, [rate(), rate({ id: 'r2', jobType: '作業員', dayPrice: 2500 })], {
      sites: [{ ...newSite('C001', 'S01', 'Aビル\n新築工事'), spec: '規制作業一式' }],
    })
    const inv = build(records, m).invoices[0]
    expect(inv.breakdowns.map((b) => [b.title, b.amount])).toEqual([
      ['Aビル 新築工事', 48000],
      ['Aビル 新築工事(作業員)', 20000],
    ])
    expect(inv.coverLines).toMatchObject([{ name: 'Aビル\n新築工事', spec: '規制作業一式', amount: 68000 }])
  })

  it('現場指定の単価を優先する', () => {
    const records = [rec(), rec({ siteId: 'S02', siteName: 'Bビル' })]
    const m = masters({}, [rate(), rate({ id: 'r2', siteId: 'S02', dayPrice: 3500 })])
    expect(build(records, m).invoices[0].coverLines.map((l) => [l.name, l.amount])).toEqual([
      ['Aビル', 24000],
      ['Bビル', 28000],
    ])
  })

  it('機材は同じ日・作業内容の行に台数 × 単価で載せる', () => {
    const equipment: EquipmentRecord[] = [
      { id: 'M1', date: '2026-10-05', clientId: 'C001', siteId: 'S01', work: '舗装補修', item: '車両トラック', quantity: 1, slipNo: '' },
      { id: 'M2', date: '2026-10-05', clientId: 'C001', siteId: 'S01', work: '舗装補修', item: 'パッカー車', quantity: 2, slipNo: '' },
      { id: 'M3', date: '2026-10-06', clientId: 'C001', siteId: 'S01', work: '準備', item: '車両トラック', quantity: 1, slipNo: '' },
    ]
    const m = masters({}, [rate()], {
      equipmentRates: [
        { ...newEquipmentRate('C001', 'S01', '車両トラック'), unitPrice: 14000 },
        { ...newEquipmentRate('C001', '', 'パッカー車'), unitPrice: 19000 },
      ],
    })
    const [b] = build([rec()], m, equipment).invoices[0].breakdowns
    expect(b.columns.map((c) => c.label)).toEqual(['日勤', '夜勤', '車両トラック', 'パッカー車'])
    expect(b.rows.map((r) => [r.date, r.work, r.quantities, r.amount])).toEqual([
      ['2026-10-05', '舗装補修', { day: 8, 'eq:車両トラック': 1, 'eq:パッカー車': 2 }, 24000 + 14000 + 38000],
      ['2026-10-06', '準備', { 'eq:車両トラック': 1 }, 14000],
    ])
  })

  it('単価が未登録の職種・機材はエラー', () => {
    const equipment: EquipmentRecord[] = [
      { id: 'M1', date: '2026-10-05', clientId: 'C001', siteId: 'S01', work: '', item: 'クレーン', quantity: 1, slipNo: '' },
    ]
    const { issues } = build([rec({ jobType: '誘導員' })], masters(), equipment)
    expect(issues.map((i) => i.level)).toEqual(['error', 'error'])
    expect(issues[0].message).toContain('誘導員')
    expect(issues[1].message).toContain('クレーン')
  })
})

describe('請求書の単位・期間・経費', () => {
  it('締め日で集計期間を区切る(20日締め)', () => {
    const records = ['2026-09-20', '2026-09-21', '2026-10-20', '2026-10-21'].map((date) => rec({ date }))
    const inv = build(records, masters({ closingDay: 20 })).invoices[0]
    expect(inv.period).toEqual({ from: '2026-09-21', to: '2026-10-20' })
    expect(inv.recordCount).toBe(2)
  })

  it('現場ごとの請求単位', () => {
    const records = [rec(), rec({ siteId: 'S02', siteName: 'Bビル' })]
    const { invoices } = build(records, masters({ invoiceUnit: 'site' }))
    expect(invoices.map((i) => [i.number, i.siteName, i.total])).toEqual([
      ['202610-C001-S01', 'Aビル', 26400],
      ['202610-C001-S02', 'Bビル', 26400],
    ])
  })

  it('経費: 本体に含める / 別の請求書にする', () => {
    const expenses = {
      '202610-C001': [
        { id: 'e1', description: '駐車場代', amount: 1500, taxRate: 10 as const },
        { id: 'e2', description: '立替金', amount: 800, taxRate: 0 as const },
      ],
    }
    const included = build([rec()], masters(), [], expenses).invoices
    expect(included).toHaveLength(1)
    expect(included[0].taxSummaries).toEqual([
      { taxRate: 10, subtotal: 25500, tax: 2550 },
      { taxRate: 0, subtotal: 800, tax: 0 },
    ])
    const separate = build([rec()], masters({ expenseMode: 'separate' }), [], expenses).invoices
    expect(separate.map((i) => [i.number, i.total])).toEqual([
      ['202610-C001', 26400],
      ['202610-C001-E', 2450],
    ])
  })

  it('未確定・伝票番号なしの実績を含む請求書には警告を出す', () => {
    const records = [rec({ confirmed: false }), rec({ slipNo: '' }), rec({ date: '2026-11-01', confirmed: false })]
    expect(build(records, masters()).issues.map((i) => i.message)).toEqual([
      '202610-C001: 未確定の実績が 1 件含まれています',
      '202610-C001: 伝票番号が空の実績が 1 件含まれています',
    ])
  })

  it('未登録の元請け、元請けIDの重複はエラー', () => {
    const m = masters()
    m.clients.push({ ...m.clients[0] })
    const { issues } = build([rec({ clientId: 'C999', clientName: '未登録建設' })], m)
    expect(issues.map((i) => i.level)).toEqual(['error', 'error'])
    expect(issues[0].message).toContain('重複')
    expect(issues[1].message).toContain('C999')
  })
})
