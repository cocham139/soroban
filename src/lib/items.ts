import type { ItemBasis, ItemRule, QuoteItem } from '../types'

/** 単位の呼び方から、数え方の見当をつける(貼り付けた見積書の初期値。あとで画面で直せる) */
export function basisFromUnit(unit: string): ItemBasis {
  const u = unit.replace(/\s/g, '').toLowerCase()
  if (/^(h|ｈ|時間|人・?h|人時)$/.test(u)) return 'personHours'
  if (/^(人|人工|人・?日|人日|人\/0\.5日)/.test(u)) return 'persons'
  if (/月/.test(u)) return 'month'
  return 'row'
}

export const BASIS_LABELS: Record<ItemBasis, string> = {
  personHours: '延べ時間(人×時間)',
  persons: '人数(1人1日)',
  row: '1作業ごとに1',
  day: '1日ごとに1',
  month: '請求書ごとに1(月額)',
}

/** 「¥142,000」「１２，０００」などを数にする。数でなければ null */
function toNumber(cell: string): number | null {
  const s = cell
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[，,]/g, '')
    .replace(/[¥￥円\s]/g, '')
    .replace(/．/g, '.')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

export interface PastedItem {
  name: string
  unit: string
  unitPrice: number
  quantity: number
  basis: ItemBasis
}

/**
 * Excelの見積書からコピーした範囲(タブ区切り)を、品目の一覧にする。
 * 1行 = 品目名・数量・単位・単価・金額 のような並び(順番や列の有無は見積書によって違うので、見当で読む)。
 * 単価が読めない行(見出し・空行・合計など)は飛ばす。
 */
export function parseQuotePaste(text: string): PastedItem[] {
  const items: PastedItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split('\t').map((c) => c.trim())
    const name = cells.find((c) => c !== '' && toNumber(c) === null) ?? ''
    if (!name || /^(合\s*計|小\s*計|総\s*計|消費税|作\s*業\s*内\s*容|項\s*目)/.test(name)) continue
    const rest = cells.slice(cells.indexOf(name) + 1).filter((c) => c !== '')
    const nums = rest.map(toNumber).filter((n): n is number => n !== null)
    const unit = rest.find((c) => toNumber(c) === null && c.length <= 8) ?? ''
    if (nums.length === 0) continue
    let quantity = 0
    let unitPrice: number
    if (nums.length >= 3 && Math.abs(nums[0] * nums[1] - nums[2]) < 1) {
      // 数量・単価・金額
      quantity = nums[0]
      unitPrice = nums[1]
    } else if (nums.length >= 2 && Math.abs(nums[0] * nums[1] - (nums[2] ?? NaN)) >= 1 && nums[0] < nums[1]) {
      // 数量・単価(金額なし)
      quantity = nums[0]
      unitPrice = nums[1]
    } else {
      unitPrice = nums[nums.length >= 2 ? nums.length - 2 : 0]
      if (nums.length === 1) unitPrice = nums[0]
    }
    if (!(unitPrice > 0)) continue
    items.push({ name, unit, unitPrice: Math.round(unitPrice), quantity, basis: basisFromUnit(unit) })
  }
  return items
}

/** 実績のまとまり(元請け × 現場 × 職種 × 作業名)に当てはまる対応づけ。より細かく指定したものを優先する */
export function findItemRule(
  rules: ItemRule[],
  clientId: string,
  siteId: string,
  jobType: string,
  work: string,
): ItemRule | undefined {
  let best: ItemRule | undefined
  let bestScore = -1
  for (const r of rules) {
    if (r.clientId !== clientId) continue
    if (r.siteId && r.siteId !== siteId) continue
    if (r.jobType && r.jobType !== jobType) continue
    if (r.work && r.work !== work) continue
    const score = (r.siteId ? 4 : 0) + (r.jobType ? 2 : 0) + (r.work ? 1 : 0)
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  return best
}

/** その元請け・現場で使える見積書の品目(現場指定のものと、全現場向けのもの) */
export function itemsFor(items: QuoteItem[], clientId: string, siteId: string): QuoteItem[] {
  return items.filter((q) => q.clientId === clientId && (q.siteId === '' || q.siteId === siteId))
}

/** 内訳書の行ごとの品目の指定に使うキー */
export function overrideKey(p: { clientId: string; siteId: string; jobType: string; date: string; work: string; time: string }) {
  return [p.clientId, p.siteId, p.jobType, p.date, p.work, p.time].join('|')
}
