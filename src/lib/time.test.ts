import { describe, expect, it } from 'vitest'
import { splitDayNight } from './time'

const split = (s: string, e: string, b: number) => splitDayNight(s, e, b, '20:00', '05:00')

describe('splitDayNight(夜勤帯 20:00〜05:00)', () => {
  it('日勤 8:30〜17:30 休憩60分 → 日勤8時間', () => {
    expect(split('08:30', '17:30', 60)).toEqual({ day: 480, night: 0 })
  })
  it('夜勤 19:00〜04:00 休憩60分 → 日勤1時間・夜勤7時間(休憩は長いほうから引く)', () => {
    expect(split('19:00', '04:00', 60)).toEqual({ day: 60, night: 420 })
  })
  it('7:00〜18:00 休憩60分 → 日勤10時間', () => {
    expect(split('07:00', '18:00', 60)).toEqual({ day: 600, night: 0 })
  })
  it('休憩なしの半日', () => {
    expect(split('08:30', '12:30', 0)).toEqual({ day: 240, night: 0 })
  })
  it('早朝にかかる勤務(04:00〜13:00)', () => {
    expect(split('04:00', '13:00', 60)).toEqual({ day: 420, night: 60 })
  })
  it('夜勤帯が日をまたがない設定(22:00〜23:59 のような帯でも動く)', () => {
    expect(splitDayNight('21:00', '23:00', 0, '22:00', '23:30')).toEqual({ day: 60, night: 60 })
  })
  it('休憩が片方の時間帯より長い場合は残りをもう片方から引く', () => {
    expect(split('19:30', '20:30', 45)).toEqual({ day: 0, night: 15 })
  })
})
