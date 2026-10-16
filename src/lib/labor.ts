import type { PayRate, WorkRecord } from '../types'

/** CSVの所属が空なら自社 */
export const OWN = '自社'
export const affiliationOf = (r: WorkRecord) => r.affiliation?.trim() || OWN

const isNight = (shiftType: string) => shiftType.includes('夜')

/** 隊員・所属・職種に当てはまる支払単価。細かく指定したものを優先(隊員 > 職種) */
export function findPayRate(rates: PayRate[], affiliation: string, staffName: string, jobType: string): PayRate | undefined {
  let best: PayRate | undefined
  let bestScore = -1
  for (const r of rates) {
    if (r.affiliation.trim() !== affiliation) continue
    if (r.staffName && r.staffName !== staffName) continue
    if (r.jobType && r.jobType !== jobType) continue
    const score = (r.staffName ? 2 : 0) + (r.jobType ? 1 : 0)
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  return best
}

/** 1回の勤務の支払額。単価がなければ null */
export function payOf(r: WorkRecord, rate: PayRate | undefined): number | null {
  if (!rate) return null
  const night = isNight(r.shiftType)
  const regular = r.workMinutes - r.overtimeMinutes
  const base =
    rate.method === 'daily'
      ? night
        ? rate.nightPrice
        : rate.dayPrice
      : ((night ? rate.nightPrice : rate.dayPrice) * regular) / 60
  return Math.round(base + (rate.overtimeHourly * r.overtimeMinutes) / 60)
}

export interface LaborLine {
  record: WorkRecord
  amount: number | null
}

/** 隊員ごとの集計 */
export interface PersonSummary {
  key: string
  staffId: string
  staffName: string
  affiliation: string
  /** 出勤日数(同じ日に2回入っても1日) */
  days: number
  dayShifts: number
  nightShifts: number
  /** 延べ実働(分) */
  workMinutes: number
  overtimeMinutes: number
  /** 支払額の合計。単価がない勤務があれば、その分は含まない */
  amount: number
  /** 単価がない勤務の数 */
  missingRate: number
  lines: LaborLine[]
}

/** 所属ごとの合計(自社の労務費、協力業者ごとの外注費) */
export interface AffiliationSummary {
  affiliation: string
  people: number
  /** のべ人日(隊員 × 出勤日) */
  personDays: number
  shifts: number
  workMinutes: number
  overtimeMinutes: number
  amount: number
  missingRate: number
}

/** 期間(from〜to、両端を含む)の実績を、隊員ごと・所属ごとにまとめる */
export function summarizeLabor(records: WorkRecord[], rates: PayRate[], from: string, to: string) {
  const people = new Map<string, PersonSummary>()
  for (const r of records) {
    if (r.date < from || r.date > to) continue
    const affiliation = affiliationOf(r)
    // 名簿にない手打ちの隊員・業者名だけの枠は、名前で区別する
    const key = `${affiliation}\u0000${r.staffId || r.staffName}`
    const p =
      people.get(key) ??
      ({
        key, staffId: r.staffId, staffName: r.staffName || '(名前なし)', affiliation,
        days: 0, dayShifts: 0, nightShifts: 0, workMinutes: 0, overtimeMinutes: 0, amount: 0, missingRate: 0, lines: [],
      } satisfies PersonSummary)
    const amount = payOf(r, findPayRate(rates, affiliation, r.staffName, r.jobType))
    p.lines.push({ record: r, amount })
    if (isNight(r.shiftType)) p.nightShifts++
    else p.dayShifts++
    p.workMinutes += r.workMinutes
    p.overtimeMinutes += r.overtimeMinutes
    if (amount === null) p.missingRate++
    else p.amount += amount
    people.set(key, p)
  }
  for (const p of people.values()) {
    p.days = new Set(p.lines.map((l) => l.record.date)).size
    p.lines.sort((a, b) => a.record.date.localeCompare(b.record.date) || a.record.start.localeCompare(b.record.start))
  }
  const list = [...people.values()].sort(
    (a, b) =>
      Number(b.affiliation === OWN) - Number(a.affiliation === OWN) ||
      a.affiliation.localeCompare(b.affiliation, 'ja') ||
      a.staffName.localeCompare(b.staffName, 'ja', { numeric: true }),
  )
  const byAff = new Map<string, AffiliationSummary>()
  for (const p of list) {
    const a =
      byAff.get(p.affiliation) ??
      { affiliation: p.affiliation, people: 0, personDays: 0, shifts: 0, workMinutes: 0, overtimeMinutes: 0, amount: 0, missingRate: 0 }
    a.people++
    a.personDays += p.days
    a.shifts += p.lines.length
    a.workMinutes += p.workMinutes
    a.overtimeMinutes += p.overtimeMinutes
    a.amount += p.amount
    a.missingRate += p.missingRate
    byAff.set(p.affiliation, a)
  }
  return { people: list, affiliations: [...byAff.values()] }
}
