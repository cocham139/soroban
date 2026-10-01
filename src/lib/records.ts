import type { Issue, WorkRecord } from '../types'
import { parseCsv } from './csv'

/** SHIRUBE 実績明細CSVのヘッダー(日本語固定)と内部キーの対応 */
export const RECORD_COLUMNS = [
  ['実績ID', 'id'],
  ['勤務日', 'date'],
  ['元請けID', 'clientId'],
  ['元請け名', 'clientName'],
  ['現場ID', 'siteId'],
  ['現場名', 'siteName'],
  ['ポストID', 'postId'],
  ['ポスト名', 'postName'],
  ['隊員ID', 'staffId'],
  ['隊員名', 'staffName'],
  ['勤務区分', 'shiftType'],
  ['開始', 'start'],
  ['終了', 'end'],
  ['休憩分', 'breakMinutes'],
  ['実働分', 'workMinutes'],
  ['残業分', 'overtimeMinutes'],
  ['深夜分', 'nightMinutes'],
  ['休日フラグ', 'holiday'],
  ['伝票番号', 'slipNo'],
  ['状態', 'confirmed'],
] as const

const MINUTE_KEYS = ['breakMinutes', 'workMinutes', 'overtimeMinutes', 'nightMinutes'] as const

export interface ParseResult {
  records: WorkRecord[]
  issues: Issue[]
}

/**
 * 実績明細CSVを読み込み、検証する。
 * 形式が壊れている行は取り込まない(error)。未確定・伝票番号なし・重複は警告(warn)。
 * existingIds を渡すと、既に取り込み済みの実績IDとの重複も検知する。
 */
export function parseWorkRecords(
  text: string,
  fileName: string,
  existingIds: ReadonlySet<string> = new Set(),
): ParseResult {
  const issues: Issue[] = []
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return { records: [], issues: [{ level: 'error', message: `${fileName}: 中身が空です` }] }
  }

  const header = rows[0].map((h) => h.trim())
  const index = new Map<string, number>()
  const missing: string[] = []
  for (const [label, key] of RECORD_COLUMNS) {
    const i = header.indexOf(label)
    if (i === -1) missing.push(label)
    else index.set(key, i)
  }
  if (missing.length > 0) {
    return {
      records: [],
      issues: [{ level: 'error', message: `${fileName}: 列が足りません(${missing.join('、')})` }],
    }
  }

  const records: WorkRecord[] = []
  const seen = new Set(existingIds)
  const unconfirmed: string[] = []
  const noSlip: string[] = []
  const duplicated: string[] = []

  rows.slice(1).forEach((row, i) => {
    const lineNo = i + 2
    const get = (key: string) => (row[index.get(key)!] ?? '').trim()
    const problems: string[] = []

    const id = get('id')
    if (!id) problems.push('実績IDが空')
    const date = get('date')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push(`勤務日「${date}」`)
    if (!get('clientId')) problems.push('元請けIDが空')
    if (!get('shiftType')) problems.push('勤務区分が空')

    const minutes = {} as Record<(typeof MINUTE_KEYS)[number], number>
    for (const key of MINUTE_KEYS) {
      const raw = get(key)
      const n = raw === '' ? 0 : Number(raw)
      if (!Number.isInteger(n) || n < 0) problems.push(`${labelOf(key)}「${raw}」`)
      minutes[key] = n
    }
    if (minutes.overtimeMinutes > minutes.workMinutes) problems.push('残業分が実働分より多い')

    const holidayRaw = get('holiday')
    if (!['', '0', '1'].includes(holidayRaw)) problems.push(`休日フラグ「${holidayRaw}」`)
    const status = get('confirmed')
    if (status !== '確定' && status !== '未確定') problems.push(`状態「${status}」`)

    if (problems.length > 0) {
      issues.push({
        level: 'error',
        message: `${fileName} ${lineNo}行目: ${problems.join('、')} のため取り込みませんでした`,
      })
      return
    }
    if (seen.has(id)) {
      duplicated.push(id)
      return
    }
    seen.add(id)

    const record: WorkRecord = {
      id,
      date,
      clientId: get('clientId'),
      clientName: get('clientName'),
      siteId: get('siteId'),
      siteName: get('siteName'),
      postId: get('postId'),
      postName: get('postName'),
      staffId: get('staffId'),
      staffName: get('staffName'),
      shiftType: get('shiftType'),
      start: get('start'),
      end: get('end'),
      ...minutes,
      holiday: holidayRaw === '1',
      slipNo: get('slipNo'),
      confirmed: status === '確定',
    }
    if (!record.confirmed) unconfirmed.push(id)
    if (!record.slipNo) noSlip.push(id)
    records.push(record)
  })

  if (duplicated.length > 0) {
    issues.push({
      level: 'warn',
      message: `${fileName}: 実績IDが重複している ${duplicated.length} 件は取り込みませんでした(${preview(duplicated)})`,
    })
  }
  if (unconfirmed.length > 0) {
    issues.push({
      level: 'warn',
      message: `${fileName}: 未確定の実績が ${unconfirmed.length} 件あります(${preview(unconfirmed)})`,
    })
  }
  if (noSlip.length > 0) {
    issues.push({
      level: 'warn',
      message: `${fileName}: 伝票番号が空の実績が ${noSlip.length} 件あります(${preview(noSlip)})`,
    })
  }
  return { records, issues }
}

function labelOf(key: string): string {
  return RECORD_COLUMNS.find(([, k]) => k === key)?.[0] ?? key
}

function preview(ids: string[]): string {
  return ids.length <= 3 ? ids.join('、') : `${ids.slice(0, 3).join('、')} ほか`
}
