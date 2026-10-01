export const yen = (n: number) => n.toLocaleString('ja-JP')

export function jpDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function monthDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}月${d}日`
}

/** 2026-08-31 → 令和8年8月分 */
export function reiwaMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `令和${y - 2018}年${m}月分`
}

/** 数量の表示(0は空欄、小数は必要な桁だけ) */
export function qty(n: number | undefined): string {
  return n ? n.toLocaleString('ja-JP', { maximumFractionDigits: 2 }) : ''
}
