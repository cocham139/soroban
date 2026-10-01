import { describe, expect, it } from 'vitest'
import type { Client, Masters, Rate, WorkRecord } from '../types'
import { buildInvoices, roundDiv, summarizeTax } from './invoice'
import { emptyMasters, newClient } from './masters'

let seq = 0
function rec(overrides: Partial<WorkRecord> = {}): WorkRecord {
  seq++
  return {
    id: `R${seq}`, date: '2026-10-05', clientId: 'C001', clientName: '○○建設',
    siteId: 'S01', siteName: 'Aビル', postId: 'P1', postName: '正門',
    staffId: 'E1', staffName: '山田', shiftType: '日勤', start: '08:00', end: '17:00',
    breakMinutes: 60, workMinutes: 480, overtimeMinutes: 0, nightMinutes: 0,
    holiday: false, slipNo: 'D-1', confirmed: true,
    ...overrides,
  }
}

function rate(overrides: Partial<Rate> = {}): Rate {
  return {
    id: 'rate', clientId: 'C001', siteId: '', shiftType: '日勤',
    unitPrice: 18000, holidayUnitPrice: 0, overtimeHourly: 2800, nightAddHourly: 0,
    ...overrides,
  }
}

function masters(client: Partial<Client> = {}, rates: Rate[] = [rate()]): Masters {
  return {
    ...emptyMasters(),
    clients: [{ ...newClient('C001', '○○建設'), ...client }],
    rates,
  }
}

describe('roundDiv', () => {
  it('端数処理の方式', () => {
    expect(roundDiv(1999, 10, 'floor')).toBe(199)
    expect(roundDiv(1995, 10, 'round')).toBe(200)
    expect(roundDiv(1991, 10, 'ceil')).toBe(200)
  })
})

describe('summarizeTax', () => {
  it('消費税は税率ごとに合計してから1回だけ端数処理する', () => {
    const line = { siteName: '', description: '', quantity: 1, unit: '式' as const, unitPrice: 0 }
    const lines = [
      { ...line, amount: 1005, taxRate: 10 as const },
      { ...line, amount: 1005, taxRate: 10 as const },
      { ...line, amount: 500, taxRate: 0 as const },
    ]
    // 明細ごとなら 100 + 100 = 200 だが、合計 2010 に対して 201
    expect(summarizeTax(lines, 'floor')).toEqual([
      { taxRate: 10, subtotal: 2010, tax: 201 },
      { taxRate: 0, subtotal: 500, tax: 0 },
    ])
  })
})

describe('buildInvoices', () => {
  it('人工(1日1人工): 人数 × 単価、残業は時間単価', () => {
    const records = [rec(), rec(), rec({ workMinutes: 570, overtimeMinutes: 90 })]
    const { invoices, issues } = buildInvoices(records, masters(), '2026-10', {})
    expect(issues).toEqual([])
    expect(invoices).toHaveLength(1)
    const inv = invoices[0]
    expect(inv.number).toBe('202610-C001')
    expect(inv.lines.map((l) => [l.description, l.quantity, l.unit, l.amount])).toEqual([
      ['日勤', 3, '人工', 54000],
      ['日勤 残業', 1.5, '時間', 4200],
    ])
    expect(inv.subtotal).toBe(58200)
    expect(inv.tax).toBe(5820)
    expect(inv.total).toBe(64020)
  })

  it('人工(按分): 所定内実働 ÷ 所定時間', () => {
    const records = [rec(), rec({ workMinutes: 240 })]
    const { invoices } = buildInvoices(records, masters({ ninkuMode: 'prorate', standardMinutes: 480 }), '2026-10', {})
    expect(invoices[0].lines[0]).toMatchObject({ quantity: 1.5, unit: '人工', amount: 27000 })
  })

  it('時間単価: 所定内実働の時間 × 単価(1円未満は四捨五入)', () => {
    const records = [rec({ workMinutes: 470 })]
    const m = masters({ billingMethod: 'hourly' }, [rate({ unitPrice: 2250, overtimeHourly: 0 })])
    const { invoices } = buildInvoices(records, m, '2026-10', {})
    // 470分 × 2250円 / 60 = 17625
    expect(invoices[0].lines[0]).toMatchObject({ quantity: 7.83, unit: '時間', amount: 17625 })
  })

  it('休日単価と深夜割増', () => {
    const records = [
      rec({ shiftType: '夜勤', nightMinutes: 300 }),
      rec({ shiftType: '夜勤', holiday: true, nightMinutes: 300 }),
    ]
    const m = masters({}, [rate({ shiftType: '夜勤', unitPrice: 20000, holidayUnitPrice: 24000, nightAddHourly: 500 })])
    const lines = buildInvoices(records, m, '2026-10', {}).invoices[0].lines
    expect(lines.map((l) => [l.description, l.amount])).toEqual([
      ['夜勤', 20000],
      ['夜勤 深夜割増', 2500],
      ['夜勤(休日)', 24000],
      ['夜勤(休日) 深夜割増', 2500],
    ])
  })

  it('現場指定の単価を優先する', () => {
    const records = [rec(), rec({ siteId: 'S02', siteName: 'Bビル' })]
    const m = masters({}, [rate(), rate({ id: 'r2', siteId: 'S02', unitPrice: 21000 })])
    const lines = buildInvoices(records, m, '2026-10', {}).invoices[0].lines
    expect(lines.map((l) => [l.siteName, l.amount])).toEqual([
      ['Aビル', 18000],
      ['Bビル', 21000],
    ])
  })

  it('締め日で集計期間を区切る(20日締め)', () => {
    const records = [
      rec({ date: '2026-09-20' }),
      rec({ date: '2026-09-21' }),
      rec({ date: '2026-10-20' }),
      rec({ date: '2026-10-21' }),
    ]
    const inv = buildInvoices(records, masters({ closingDay: 20 }), '2026-10', {}).invoices[0]
    expect(inv.period).toEqual({ from: '2026-09-21', to: '2026-10-20' })
    expect(inv.recordCount).toBe(2)
  })

  it('現場ごとの請求単位', () => {
    const records = [rec(), rec({ siteId: 'S02', siteName: 'Bビル' })]
    const { invoices } = buildInvoices(records, masters({ invoiceUnit: 'site' }), '2026-10', {})
    expect(invoices.map((i) => [i.number, i.siteName, i.total])).toEqual([
      ['202610-C001-S01', 'Aビル', 19800],
      ['202610-C001-S02', 'Bビル', 19800],
    ])
  })

  it('経費: 本体に含める / 別の請求書にする', () => {
    const expenses = {
      '202610-C001': [
        { id: 'e1', description: '駐車場代', amount: 1500, taxRate: 10 as const },
        { id: 'e2', description: '立替金', amount: 800, taxRate: 0 as const },
      ],
    }
    const included = buildInvoices([rec()], masters(), '2026-10', expenses).invoices
    expect(included).toHaveLength(1)
    expect(included[0].taxSummaries).toEqual([
      { taxRate: 10, subtotal: 19500, tax: 1950 },
      { taxRate: 0, subtotal: 800, tax: 0 },
    ])
    expect(included[0].total).toBe(22250)

    const separate = buildInvoices([rec()], masters({ expenseMode: 'separate' }), '2026-10', expenses).invoices
    expect(separate.map((i) => [i.number, i.total])).toEqual([
      ['202610-C001', 19800],
      ['202610-C001-E', 2450],
    ])
    expect(separate[1].expenseKey).toBe('202610-C001')
  })

  it('未登録の元請け・単価はエラーとして知らせる', () => {
    const records = [rec({ clientId: 'C999', clientName: '未登録建設' }), rec({ shiftType: '夜勤' })]
    const { invoices, issues } = buildInvoices(records, masters(), '2026-10', {})
    expect(issues.map((i) => i.level)).toEqual(['error', 'error'])
    expect(issues[0].message).toContain('C999')
    expect(issues[1].message).toContain('夜勤')
    expect(invoices[0].lines).toEqual([])
  })

  it('残業があるのに残業単価が未設定なら警告', () => {
    const records = [rec({ workMinutes: 540, overtimeMinutes: 60 })]
    const { issues } = buildInvoices(records, masters({}, [rate({ overtimeHourly: 0 })]), '2026-10', {})
    expect(issues).toHaveLength(1)
    expect(issues[0].level).toBe('warn')
  })

  it('未確定・伝票番号なしの実績を含む請求書には警告を出す', () => {
    const records = [rec({ confirmed: false }), rec({ slipNo: '' }), rec({ date: '2026-11-01', confirmed: false })]
    const { issues } = buildInvoices(records, masters(), '2026-10', {})
    expect(issues.map((i) => i.message)).toEqual([
      '202610-C001: 未確定の実績が 1 件含まれています',
      '202610-C001: 伝票番号が空の実績が 1 件含まれています',
    ])
  })

  it('元請けIDの重複はエラー', () => {
    const m = masters()
    m.clients.push({ ...m.clients[0] })
    const { issues } = buildInvoices([], m, '2026-10', {})
    expect(issues[0]).toMatchObject({ level: 'error' })
    expect(issues[0].message).toContain('重複')
  })
})
