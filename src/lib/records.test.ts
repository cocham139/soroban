import { describe, expect, it } from 'vitest'
import { RECORD_COLUMNS, parseWorkRecords } from './records'

const header = RECORD_COLUMNS.map(([label]) => label).join(',')
const row = (overrides: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    実績ID: 'R1', 勤務日: '2026-10-01', 元請けID: 'C001', 元請け名: '○○建設',
    現場ID: 'S01', 現場名: 'Aビル', ポストID: 'P1', ポスト名: '正門',
    隊員ID: 'E1', 隊員名: '山田', 勤務区分: '日勤', 開始: '08:00', 終了: '17:00',
    休憩分: '60', 実働分: '480', 残業分: '0', 深夜分: '0', 休日フラグ: '0',
    伝票番号: 'D-1', 状態: '確定',
  }
  const merged = { ...base, ...overrides }
  return RECORD_COLUMNS.map(([label]) => merged[label]).join(',')
}

describe('parseWorkRecords', () => {
  it('正しい行を取り込む', () => {
    const { records, issues } = parseWorkRecords(`${header}\n${row()}`, 'a.csv')
    expect(issues).toEqual([])
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ id: 'R1', workMinutes: 480, holiday: false, confirmed: true })
  })

  it('列が足りなければエラー', () => {
    const { records, issues } = parseWorkRecords('実績ID,勤務日\nR1,2026-10-01', 'a.csv')
    expect(records).toEqual([])
    expect(issues[0].level).toBe('error')
    expect(issues[0].message).toContain('元請けID')
  })

  it('列の順番が違っても読める', () => {
    const cols = RECORD_COLUMNS.map(([l]) => l).reverse()
    const values = row().split(',').reverse()
    const { records } = parseWorkRecords(`${cols.join(',')}\n${values.join(',')}`, 'a.csv')
    expect(records[0].id).toBe('R1')
  })

  it('形式が壊れた行は取り込まずエラーにする', () => {
    const text = [header, row({ 実働分: '7.5' }), row({ 実績ID: 'R2', 勤務日: '10/1' })].join('\n')
    const { records, issues } = parseWorkRecords(text, 'a.csv')
    expect(records).toEqual([])
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(2)
    expect(issues[0].message).toContain('2行目')
  })

  it('未確定・伝票番号なし・重複は警告', () => {
    const text = [
      header,
      row({ 状態: '未確定' }),
      row({ 実績ID: 'R2', 伝票番号: '' }),
      row({ 実績ID: 'R2' }),
    ].join('\n')
    const { records, issues } = parseWorkRecords(text, 'a.csv')
    expect(records.map((r) => r.id)).toEqual(['R1', 'R2'])
    expect(issues.map((i) => i.level)).toEqual(['warn', 'warn', 'warn'])
  })

  it('取り込み済みのIDとの重複も検知する', () => {
    const { records, issues } = parseWorkRecords(`${header}\n${row()}`, 'b.csv', new Set(['R1']))
    expect(records).toEqual([])
    expect(issues[0].message).toContain('重複')
  })
})
