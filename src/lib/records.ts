import type { EquipmentRecord, Issue, WorkRecord } from '../types'
import { parseCsv } from './csv'

interface Column {
  label: string
  key: string
  required: boolean
}

const col = (label: string, key: string, required = true): Column => ({ label, key, required })

/** SHIRUBE 実績明細CSVの列(ヘッダーは日本語固定。順番は問わない) */
export const RECORD_COLUMNS: Column[] = [
  col('実績ID', 'id'),
  col('勤務日', 'date'),
  col('元請けID', 'clientId'),
  col('元請け名', 'clientName', false),
  col('現場ID', 'siteId'),
  col('現場名', 'siteName', false),
  col('ポストID', 'postId', false),
  col('ポスト名', 'postName', false),
  col('隊員ID', 'staffId', false),
  col('隊員名', 'staffName', false),
  col('職種', 'jobType', false),
  col('作業内容', 'work', false),
  col('勤務区分', 'shiftType'),
  col('開始', 'start'),
  col('終了', 'end'),
  col('休憩分', 'breakMinutes'),
  col('実働分', 'workMinutes'),
  col('残業分', 'overtimeMinutes', false),
  col('伝票番号', 'slipNo', false),
  col('状態', 'confirmed'),
]

/** SHIRUBE 機材明細CSVの列 */
export const EQUIPMENT_COLUMNS: Column[] = [
  col('機材明細ID', 'id'),
  col('勤務日', 'date'),
  col('元請けID', 'clientId'),
  col('現場ID', 'siteId'),
  col('作業内容', 'work', false),
  col('品目', 'item'),
  col('数量', 'quantity'),
  col('伝票番号', 'slipNo', false),
]

export type CsvKind = 'records' | 'equipment'

export interface ParseResult {
  kind: CsvKind | null
  records: WorkRecord[]
  equipment: EquipmentRecord[]
  issues: Issue[]
}

type Getter = (key: string) => string

function readTable(text: string, fileName: string, columns: Column[]) {
  const rows = parseCsv(text)
  const header = (rows[0] ?? []).map((h) => h.trim())
  const index = new Map<string, number>()
  const missing: string[] = []
  for (const c of columns) {
    const i = header.indexOf(c.label)
    if (i !== -1) index.set(c.key, i)
    else if (c.required) missing.push(c.label)
  }
  if (missing.length > 0) {
    throw new Error(`${fileName}: 列が足りません(${missing.join('、')})`)
  }
  return rows.slice(1).map((row): Getter => (key) => {
    const i = index.get(key)
    return i === undefined ? '' : (row[i] ?? '').trim()
  })
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
const isTime = (s: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s)
const minutes = (raw: string) => (raw === '' ? 0 : Number(raw))
const isNonNegativeInt = (n: number) => Number.isInteger(n) && n >= 0

/** ヘッダーから実績明細か機材明細かを判別する */
export function detectKind(text: string): CsvKind | null {
  const header = (parseCsv(text.split(/\r?\n/, 1)[0] ?? '')[0] ?? []).map((h) => h.trim())
  if (header.includes('機材明細ID')) return 'equipment'
  if (header.includes('実績ID')) return 'records'
  return null
}

function preview(ids: string[]): string {
  return ids.length <= 3 ? ids.join('、') : `${ids.slice(0, 3).join('、')} ほか`
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
  const result: ParseResult = { kind: 'records', records: [], equipment: [], issues: [] }
  let rows: Getter[]
  try {
    rows = readTable(text, fileName, RECORD_COLUMNS)
  } catch (e) {
    result.issues.push({ level: 'error', message: (e as Error).message })
    return result
  }

  const seen = new Set(existingIds)
  const unconfirmed: string[] = []
  const noSlip: string[] = []
  const duplicated: string[] = []

  rows.forEach((get, i) => {
    const problems: string[] = []
    const id = get('id')
    if (!id) problems.push('実績IDが空')
    if (!isDate(get('date'))) problems.push(`勤務日「${get('date')}」`)
    if (!get('clientId')) problems.push('元請けIDが空')
    if (!get('siteId')) problems.push('現場IDが空')
    if (!get('shiftType')) problems.push('勤務区分が空')
    for (const k of ['start', 'end'] as const) {
      if (!isTime(get(k))) problems.push(`${k === 'start' ? '開始' : '終了'}「${get(k)}」`)
    }
    const breakMinutes = minutes(get('breakMinutes'))
    const workMinutes = minutes(get('workMinutes'))
    const overtimeMinutes = minutes(get('overtimeMinutes'))
    if (!isNonNegativeInt(breakMinutes)) problems.push(`休憩分「${get('breakMinutes')}」`)
    if (!isNonNegativeInt(workMinutes)) problems.push(`実働分「${get('workMinutes')}」`)
    if (!isNonNegativeInt(overtimeMinutes)) problems.push(`残業分「${get('overtimeMinutes')}」`)
    else if (overtimeMinutes > workMinutes) problems.push('残業分が実働分より多い')
    const status = get('confirmed')
    if (status !== '確定' && status !== '未確定') problems.push(`状態「${status}」`)

    if (problems.length > 0) {
      result.issues.push({
        level: 'error',
        message: `${fileName} ${i + 2}行目: ${problems.join('、')} のため取り込みませんでした`,
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
      date: get('date'),
      clientId: get('clientId'),
      clientName: get('clientName'),
      siteId: get('siteId'),
      siteName: get('siteName') || get('siteId'),
      postId: get('postId'),
      postName: get('postName'),
      staffId: get('staffId'),
      staffName: get('staffName'),
      jobType: get('jobType'),
      work: get('work'),
      shiftType: get('shiftType'),
      start: get('start').padStart(5, '0'),
      end: get('end').padStart(5, '0'),
      breakMinutes,
      workMinutes,
      overtimeMinutes,
      slipNo: get('slipNo'),
      confirmed: status === '確定',
    }
    if (!record.confirmed) unconfirmed.push(id)
    if (!record.slipNo) noSlip.push(id)
    result.records.push(record)
  })

  if (duplicated.length > 0) {
    result.issues.push({
      level: 'warn',
      message: `${fileName}: 実績IDが重複している ${duplicated.length} 件は取り込みませんでした(${preview(duplicated)})`,
    })
  }
  if (unconfirmed.length > 0) {
    result.issues.push({
      level: 'warn',
      message: `${fileName}: 未確定の実績が ${unconfirmed.length} 件あります(${preview(unconfirmed)})`,
    })
  }
  if (noSlip.length > 0) {
    result.issues.push({
      level: 'warn',
      message: `${fileName}: 伝票番号が空の実績が ${noSlip.length} 件あります(${preview(noSlip)})`,
    })
  }
  return result
}

/** 機材明細CSVを読み込み、検証する */
export function parseEquipment(
  text: string,
  fileName: string,
  existingIds: ReadonlySet<string> = new Set(),
): ParseResult {
  const result: ParseResult = { kind: 'equipment', records: [], equipment: [], issues: [] }
  let rows: Getter[]
  try {
    rows = readTable(text, fileName, EQUIPMENT_COLUMNS)
  } catch (e) {
    result.issues.push({ level: 'error', message: (e as Error).message })
    return result
  }
  const seen = new Set(existingIds)
  const duplicated: string[] = []

  rows.forEach((get, i) => {
    const problems: string[] = []
    const id = get('id')
    if (!id) problems.push('機材明細IDが空')
    if (!isDate(get('date'))) problems.push(`勤務日「${get('date')}」`)
    if (!get('clientId')) problems.push('元請けIDが空')
    if (!get('siteId')) problems.push('現場IDが空')
    if (!get('item')) problems.push('品目が空')
    const quantity = Number(get('quantity'))
    if (!isNonNegativeInt(quantity)) problems.push(`数量「${get('quantity')}」`)
    if (problems.length > 0) {
      result.issues.push({
        level: 'error',
        message: `${fileName} ${i + 2}行目: ${problems.join('、')} のため取り込みませんでした`,
      })
      return
    }
    if (seen.has(id)) {
      duplicated.push(id)
      return
    }
    seen.add(id)
    result.equipment.push({
      id,
      date: get('date'),
      clientId: get('clientId'),
      siteId: get('siteId'),
      work: get('work'),
      item: get('item'),
      quantity,
      slipNo: get('slipNo'),
    })
  })
  if (duplicated.length > 0) {
    result.issues.push({
      level: 'warn',
      message: `${fileName}: 機材明細IDが重複している ${duplicated.length} 件は取り込みませんでした(${preview(duplicated)})`,
    })
  }
  return result
}

/** ヘッダーで種類を判別して読み込む */
export function parseAnyCsv(
  text: string,
  fileName: string,
  existing: { recordIds: ReadonlySet<string>; equipmentIds: ReadonlySet<string> },
): ParseResult {
  const kind = detectKind(text)
  if (kind === 'records') return parseWorkRecords(text, fileName, existing.recordIds)
  if (kind === 'equipment') return parseEquipment(text, fileName, existing.equipmentIds)
  return {
    kind: null,
    records: [],
    equipment: [],
    issues: [
      {
        level: 'error',
        message: `${fileName}: 実績明細(「実績ID」列)でも機材明細(「機材明細ID」列)でもありません`,
      },
    ],
  }
}
