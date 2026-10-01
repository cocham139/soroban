import { describe, expect, it } from 'vitest'
import { billingPeriod, dueDate, previousMonth } from './period'

describe('billingPeriod', () => {
  it('末日締めはその月の1日〜末日', () => {
    expect(billingPeriod('2026-10', 0)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(billingPeriod('2028-02', 0)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('20日締めは前月21日〜当月20日', () => {
    expect(billingPeriod('2026-10', 20)).toEqual({ from: '2026-09-21', to: '2026-10-20' })
  })

  it('年をまたぐ', () => {
    expect(billingPeriod('2027-01', 15)).toEqual({ from: '2026-12-16', to: '2027-01-15' })
  })

  it('締め日がその月にない場合は末日で締め、期間が途切れない', () => {
    expect(billingPeriod('2026-02', 30)).toEqual({ from: '2026-01-31', to: '2026-02-28' })
    expect(billingPeriod('2026-03', 30)).toEqual({ from: '2026-03-01', to: '2026-03-30' })
    expect(billingPeriod('2026-04', 30)).toEqual({ from: '2026-03-31', to: '2026-04-30' })
  })
})

describe('dueDate', () => {
  it('翌月末', () => {
    expect(dueDate('2026-12', 1, 0)).toBe('2027-01-31')
  })
  it('翌々月10日', () => {
    expect(dueDate('2026-10', 2, 10)).toBe('2026-12-10')
  })
  it('支払日が月にない場合は末日', () => {
    expect(dueDate('2027-01', 1, 30)).toBe('2027-02-28')
  })
})

it('previousMonth', () => {
  expect(previousMonth(new Date(2026, 0, 15))).toBe('2025-12')
  expect(previousMonth(new Date(2026, 9, 1))).toBe('2026-09')
})
