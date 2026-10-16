import { describe, expect, it } from 'vitest'
import type { WorkRecord } from '../types'
import { findPayRate, payOf, summarizeLabor } from './labor'
import { newPayRate } from './masters'

let seq = 0
const rec = (o: Partial<WorkRecord> = {}): WorkRecord => ({
  id: `R${++seq}`, date: '2026-10-05', clientId: 'C1', clientName: '○○建設', siteId: 'S1', siteName: 'A現場',
  postId: '', postName: '', staffId: 'E1', staffName: '山田', jobType: '規制保安員', work: '舗装補修',
  shiftType: '日勤', start: '08:30', end: '17:30', breakMinutes: 60, workMinutes: 480, overtimeMinutes: 0,
  slipNo: 'D-1', confirmed: true, affiliation: '', ...o,
})

describe('支払単価', () => {
  const rates = [
    newPayRate({ id: 'own', affiliation: '自社', dayPrice: 12000, nightPrice: 14000, overtimeHourly: 1800 }),
    newPayRate({ id: 'ownSato', affiliation: '自社', staffName: '佐藤', dayPrice: 13000, nightPrice: 15000 }),
    newPayRate({ id: 'sub', affiliation: '△△警備', method: 'hourly', dayPrice: 1600, nightPrice: 2000 }),
  ]
  it('隊員の指定を優先し、なければ所属の単価', () => {
    expect(findPayRate(rates, '自社', '佐藤', '規制保安員')?.id).toBe('ownSato')
    expect(findPayRate(rates, '自社', '山田', '規制保安員')?.id).toBe('own')
    expect(findPayRate(rates, '□□警備', '山田', '')).toBeUndefined()
  })
  it('日給は勤務区分で日勤・夜勤、時給は実働(残業を除く)に掛け、残業は時給で足す', () => {
    expect(payOf(rec({ overtimeMinutes: 60, workMinutes: 540 }), rates[0])).toBe(12000 + 1800)
    expect(payOf(rec({ shiftType: '夜勤' }), rates[0])).toBe(14000)
    expect(payOf(rec(), rates[2])).toBe(1600 * 8)
    expect(payOf(rec(), undefined)).toBeNull()
  })
})

describe('隊員ごと・所属ごとの集計', () => {
  it('所属が空は自社。出勤日数は同じ日を1日と数え、協力業者ごとに外注費をまとめる', () => {
    const records = [
      rec(), rec({ date: '2026-10-06' }), rec({ date: '2026-10-06', start: '19:00', shiftType: '夜勤' }),
      rec({ staffId: '', staffName: '△△警備', affiliation: '△△警備' }),
      rec({ staffId: '', staffName: '△△警備', affiliation: '△△警備', id: 'X' }),
      rec({ date: '2026-11-01' }),
    ]
    const rates = [newPayRate({ affiliation: '自社', dayPrice: 12000, nightPrice: 14000 }), newPayRate({ affiliation: '△△警備', dayPrice: 20000 })]
    const { people, affiliations } = summarizeLabor(records, rates, '2026-10-01', '2026-10-31')
    expect(people.map((p) => [p.affiliation, p.staffName, p.days, p.dayShifts, p.nightShifts, p.amount])).toEqual([
      ['自社', '山田', 2, 2, 1, 12000 + 12000 + 14000],
      ['△△警備', '△△警備', 1, 2, 0, 40000],
    ])
    expect(affiliations.map((a) => [a.affiliation, a.people, a.personDays, a.shifts, a.amount])).toEqual([
      ['自社', 1, 2, 3, 38000],
      ['△△警備', 1, 1, 2, 40000],
    ])
  })
  it('単価がない勤務は数えて知らせ、金額には含めない', () => {
    const { affiliations } = summarizeLabor([rec(), rec({ affiliation: '□□警備', staffName: '鈴木', staffId: 'E2' })], [], '2026-10-01', '2026-10-31')
    expect(affiliations.map((a) => [a.affiliation, a.amount, a.missingRate])).toEqual([['自社', 0, 1], ['□□警備', 0, 1]])
  })
})
