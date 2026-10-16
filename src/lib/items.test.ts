import { describe, expect, it } from 'vitest'
import type { Masters, QuoteItem, WorkRecord } from '../types'
import { basisFromUnit, findItemRule, overrideKey, parseQuotePaste } from './items'
import { buildInvoices } from './invoice'
import { emptyMasters, newClient, newEquipmentRate, newItemRule, newQuoteItem } from './masters'

describe('見積書の貼り付け', () => {
  it('品目・数量・単位・単価・金額の並びを読み、見出しや合計の行は飛ばす', () => {
    const text = [
      '作 業 内 容\t数 量\t単 位\t単 価\t金額\t備 考',
      '一般道 片側交互通行規制(昼間)×Ⅰ\t4\t日\t¥142,000\t¥568,000\t',
      '交通誘導員(夜間)\t1\t人\t¥36,000\t¥36,000',
      '休憩施設清掃\t\t\t\t',
      '作業員(N)\t90.0\th\t5,100\t459,000',
      '休憩施設清掃 東郷PA(上)\t12.0\t月\t1,830,000\t21,960,000',
      '合計\t\t\t\t¥10,509,400',
    ].join('\n')
    expect(parseQuotePaste(text)).toEqual([
      { name: '一般道 片側交互通行規制(昼間)×Ⅰ', unit: '日', unitPrice: 142000, quantity: 4, basis: 'row' },
      { name: '交通誘導員(夜間)', unit: '人', unitPrice: 36000, quantity: 1, basis: 'persons' },
      { name: '作業員(N)', unit: 'h', unitPrice: 5100, quantity: 90, basis: 'personHours' },
      { name: '休憩施設清掃 東郷PA(上)', unit: '月', unitPrice: 1830000, quantity: 12, basis: 'month' },
    ])
  })

  it('単価だけの行(数量・金額なし)も読める', () => {
    expect(parseQuotePaste('規制機材借用・返納\t回\t206000')).toEqual([
      { name: '規制機材借用・返納', unit: '回', unitPrice: 206000, quantity: 0, basis: 'row' },
    ])
  })

  it('単位から数え方の見当をつける', () => {
    expect(['h', '人', '人/0.5日', '日', '回', '台', '月', '台・月'].map(basisFromUnit)).toEqual([
      'personHours', 'persons', 'persons', 'row', 'row', 'row', 'month', 'month',
    ])
  })
})

describe('対応づけ', () => {
  it('より細かく指定した対応づけを優先し、空欄は「どれでも」', () => {
    const rules = [
      newItemRule({ id: 'a', clientId: 'C1', dayItemId: 'x' }),
      newItemRule({ id: 'b', clientId: 'C1', jobType: '規制保安員', dayItemId: 'y' }),
      newItemRule({ id: 'c', clientId: 'C1', siteId: 'S1', jobType: '規制保安員', work: '事故復旧', dayItemId: 'z' }),
    ]
    expect(findItemRule(rules, 'C1', 'S1', '規制保安員', '事故復旧')?.id).toBe('c')
    expect(findItemRule(rules, 'C1', 'S1', '規制保安員', '舗装補修')?.id).toBe('b')
    expect(findItemRule(rules, 'C1', 'S2', '作業員', '')?.id).toBe('a')
    expect(findItemRule(rules, 'C2', 'S1', '', '')).toBeUndefined()
  })
})

let seq = 0
const rec = (o: Partial<WorkRecord> = {}): WorkRecord => ({
  id: `R${++seq}`, date: '2026-10-05', clientId: 'C1', clientName: '○○開発', siteId: 'S1', siteName: '橋梁点検',
  postId: '', postName: '', staffId: '', staffName: '', jobType: '規制保安員', work: '橋梁定期点検',
  shiftType: '日勤', start: '08:30', end: '17:30', breakMinutes: 60, workMinutes: 480, overtimeMinutes: 0,
  slipNo: 'D-1', confirmed: true, affiliation: '', ...o,
})
const item = (id: string, o: Partial<QuoteItem>) => newQuoteItem('C1', '', { id, ...o })

function masters(o: Partial<Masters> = {}): Masters {
  return {
    ...emptyMasters(),
    clients: [newClient('C1', '○○開発')],
    quoteItems: [
      item('kisei1', { name: '片側交互通行規制(昼間)×Ⅰ', unit: '日', unitPrice: 142000, basis: 'row' }),
      item('kisei2', { name: '片側交互通行規制(昼間)×Ⅱ うち切替1回', unit: '日', unitPrice: 152000, basis: 'row' }),
      item('sagyo', { name: '作業員', unit: 'h', unitPrice: 3700, basis: 'personHours' }),
      item('sagyoN', { name: '作業員(N)', unit: 'h', unitPrice: 5100, basis: 'personHours' }),
      item('seisou', { name: '休憩施設清掃', unit: '月', unitPrice: 1830000, basis: 'month' }),
    ],
    ...o,
  }
}
const build = (records: WorkRecord[], m: Masters, overrides = {}) => buildInvoices(records, [], m, '2026-10', {}, overrides)

describe('見積書の品目で請求する', () => {
  it('対応づけがない実績は割り当て待ちにし、請求書は下書き(載せない)', () => {
    const { invoices, issues } = build([rec(), rec(), rec({ date: '2026-10-06' })], masters())
    expect(invoices[0].unassigned).toEqual([
      { clientId: 'C1', clientName: '○○開発', siteId: 'S1', siteName: '橋梁点検', jobType: '規制保安員', work: '橋梁定期点検', hasNight: false, rows: 2 },
    ])
    expect(invoices[0].subtotal).toBe(0)
    expect(issues.some((i) => i.level === 'error' && i.message.includes('下書き'))).toBe(true)
  })

  it('対応づけた品目で、明細形式(1行に1品目)の内訳書を作る。1作業ごとに1日', () => {
    const m = masters({ itemRules: [newItemRule({ clientId: 'C1', jobType: '規制保安員', dayItemId: 'kisei1' })] })
    const { invoices } = build([rec(), rec(), rec({ date: '2026-10-06' })], m)
    const b = invoices[0].breakdowns[0]
    expect(b.layout).toBe('lines')
    expect(b.rows.map((r) => [r.date, r.item?.name, r.item?.quantity, r.amount])).toEqual([
      ['2026-10-05', '片側交互通行規制(昼間)×Ⅰ', 1, 142000],
      ['2026-10-06', '片側交互通行規制(昼間)×Ⅰ', 1, 142000],
    ])
    expect(invoices[0].unassigned).toEqual([])
    expect(invoices[0].subtotal).toBe(284000)
  })

  it('行ごとの指定で、その日だけ品目を変えられる(切替が増えた日など)', () => {
    const m = masters({ itemRules: [newItemRule({ clientId: 'C1', dayItemId: 'kisei1' })] })
    const key = overrideKey({ clientId: 'C1', siteId: 'S1', jobType: '規制保安員', date: '2026-10-06', work: '橋梁定期点検', time: '08:30-17:30' })
    const { invoices } = build([rec(), rec({ date: '2026-10-06' })], m, { [key]: 'kisei2' })
    expect(invoices[0].breakdowns[0].rows.map((r) => r.item?.name)).toEqual(['片側交互通行規制(昼間)×Ⅰ', '片側交互通行規制(昼間)×Ⅱ うち切替1回'])
    expect(invoices[0].breakdowns[0].rows[1].key).toBe(key)
  })

  it('延べ時間の品目は、昼の時間と夜の時間を別の品目にできる', () => {
    const m = masters({ itemRules: [newItemRule({ clientId: 'C1', jobType: '作業員', dayItemId: 'sagyo', nightItemId: 'sagyoN' })] })
    // 19:00〜04:00 休憩60分 = 昼1時間・夜7時間 × 2人
    const night = { jobType: '作業員', shiftType: '夜勤', start: '19:00', end: '04:00' }
    const { invoices } = build([rec(night), rec(night)], m)
    expect(invoices[0].breakdowns[0].rows.map((r) => [r.item?.name, r.item?.quantity, r.amount])).toEqual([
      ['作業員', 2, 7400],
      ['作業員(N)', 14, 71400],
    ])
  })

  it('月額の品目は請求書ごとに1回だけ', () => {
    const m = masters({ itemRules: [newItemRule({ clientId: 'C1', dayItemId: 'seisou' })] })
    const { invoices } = build([rec(), rec({ date: '2026-10-06' }), rec({ date: '2026-10-07' })], m)
    expect(invoices[0].subtotal).toBe(1830000)
  })

  it('見積書にない品目(追加分)を使うと、追加の見積書が必要と知らせる', () => {
    const m = masters({
      quoteItems: [item('new', { name: '交差点規制(昼間)×Ⅰ うち切替7回', unit: '日', unitPrice: 240600, basis: 'row', needsQuote: true })],
      itemRules: [newItemRule({ clientId: 'C1', dayItemId: 'new' })],
    })
    const { issues } = build([rec()], m)
    expect(issues.some((i) => i.level === 'warn' && i.message.includes('追加の見積書が必要'))).toBe(true)
  })

  it('見積書がない元請けは、これまでどおり人の単価で計算する', () => {
    const m = masters({ quoteItems: [] })
    const { issues } = build([rec()], m)
    expect(issues.some((i) => i.message.includes('単価が未登録'))).toBe(true)
  })

  it('明細形式では、機材も1行に1品目で載せる', () => {
    const m = masters({
      itemRules: [newItemRule({ clientId: 'C1', dayItemId: 'kisei1' })],
      equipmentRates: [{ ...newEquipmentRate('C1', '', '車両トラック'), unitPrice: 25000 }],
    })
    const eq = [{ id: 'M1', date: '2026-10-05', clientId: 'C1', siteId: 'S1', work: '', item: '車両トラック', quantity: 1, slipNo: '', source: 'manual' as const }]
    const { invoices } = buildInvoices([rec()], eq, m, '2026-10', {})
    expect(invoices[0].breakdowns[0].rows.map((r) => r.item?.name)).toEqual(['片側交互通行規制(昼間)×Ⅰ', '車両トラック'])
    expect(invoices[0].subtotal).toBe(167000)
  })
})
