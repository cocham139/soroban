const pad = (n: number) => String(n).padStart(2, '0')

function lastDayOf(year: number, month: number): number {
  // month は 1〜12。Date.UTC の月は0始まりなので month を渡すと翌月、日0で前月末になる
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const idx = year * 12 + (month - 1) + delta
  return [Math.floor(idx / 12), (idx % 12) + 1]
}

function fmt(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function parseMonth(month: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) throw new Error(`月の形式が不正です: ${month}`)
  return [Number(m[1]), Number(m[2])]
}

/** その月に締める実日付。締め日がその月に存在しない場合(例: 2月30日)は末日 */
function closingDateOf(year: number, month: number, closingDay: number): number {
  const last = lastDayOf(year, month)
  return closingDay === 0 ? last : Math.min(closingDay, last)
}

/**
 * 請求月と締め日から集計期間を求める。
 * 例: 2026-10, 20日締め → 2026-09-21 〜 2026-10-20
 */
export function billingPeriod(month: string, closingDay: number): { from: string; to: string } {
  const [y, m] = parseMonth(month)
  const toDay = closingDateOf(y, m, closingDay)
  const [py, pm] = shiftMonth(y, m, -1)
  const prevClose = closingDateOf(py, pm, closingDay)
  const from =
    prevClose === lastDayOf(py, pm) ? fmt(y, m, 1) : fmt(py, pm, prevClose + 1)
  return { from, to: fmt(y, m, toDay) }
}

/** 支払期限。請求月から offset か月後の payDay(0 = 末日) */
export function dueDate(month: string, offset: number, payDay: number): string {
  const [y, m] = parseMonth(month)
  const [dy, dm] = shiftMonth(y, m, offset)
  const last = lastDayOf(dy, dm)
  return fmt(dy, dm, payDay === 0 ? last : Math.min(payDay, last))
}

/** 基準日の前月(YYYY-MM)。請求月の初期値に使う */
export function previousMonth(today: Date): string {
  const [y, m] = shiftMonth(today.getFullYear(), today.getMonth() + 1, -1)
  return `${y}-${pad(m)}`
}

export function todayString(today: Date): string {
  return fmt(today.getFullYear(), today.getMonth() + 1, today.getDate())
}
