// サンプルの実績明細CSV・機材明細CSV(すべて架空のデータ)を作る: node sample/make-sample.mjs
import { writeFileSync } from 'node:fs'

const RECORD_HEADER = ['実績ID','勤務日','元請けID','元請け名','現場ID','現場名','ポストID','ポスト名','隊員ID','隊員名','職種','作業内容','勤務区分','開始','終了','休憩分','実働分','残業分','伝票番号','状態']
const EQUIPMENT_HEADER = ['機材明細ID','勤務日','元請けID','現場ID','作業内容','品目','数量','伝票番号']

const records = []
const equipment = []
let n = 0
let staffNo = 0
const day = (m, d) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const span = (s, e) => { let x = toMin(e) - toMin(s); if (x <= 0) x += 1440; return x }

/** 1つの作業に people 人を配置する(伝票1枚 = 1作業) */
function work(date, client, site, task, people, start, end, opts = {}) {
  const brk = opts.break ?? (span(start, end) > 360 ? 60 : 0)
  const slip = `D-${2000 + n}`
  for (let i = 0; i < people; i++) {
    n++
    staffNo = (staffNo % 30) + 1
    records.push([
      `R${date.replaceAll('-', '')}-${String(n).padStart(4, '0')}`, date, ...client, ...site, 'P1', '規制帯',
      `E${String(staffNo).padStart(3, '0')}`, `隊員${staffNo}`, opts.job ?? '規制保安員', task,
      toMin(start) >= toMin('18:00') ? '夜勤' : '日勤', start, end, brk, span(start, end) - brk, 0,
      opts.noSlip && i === 0 ? '' : slip, opts.unconfirmed && i === 0 ? '未確定' : '確定',
    ])
  }
  for (const [item, qty] of opts.equipment ?? []) {
    equipment.push([`M${date.replaceAll('-', '')}-${String(equipment.length + 1).padStart(3, '0')}`, date, client[0], site[0], task, item, qty, slip])
  }
}

const tozai = ['C001', '東西道路管理株式会社']
const S01 = ['S01', '中央道 みどり管内維持修繕業務']
const S02 = ['S02', 'さくらバイパス 道路維持工事']
const S03 = ['S03', 'あおば橋 橋梁定期点検 規制・保安業務']
const tasks = ['植栽関係作業', '舗装小補修', '伸縮装置補修', '構造物補修', '路面清掃']

for (let d = 1; d <= 31; d++) {
  const date = day(10, d)
  const dow = new Date(2026, 9, d).getDay()
  if (dow === 0 || dow === 6) continue
  // S01: 日中の作業と夜間の規制
  work(date, tozai, S01, tasks[d % 3], 3 + (d % 3), '08:30', '17:30')
  if (d % 2 === 0) work(date, tozai, S01, tasks[3 + (d % 2)], 6 + (d % 4), '19:00', '04:00', { unconfirmed: d === 30 })
  if (d % 5 === 0) work(date, tozai, S01, '路面清掃C', 1, '08:30', '17:30', { job: '作業員' })
  // S02: 除草(車両・機材つき)
  if (d <= 9) work(date, tozai, S02, 'さくらバイパス除草工', 6, '08:30', '17:30', {
    equipment: [['車両トラック', 1], ['パッカー車', 2], ['作業道具一式', 1]],
  })
  // S03: 橋梁点検(車両・規制材つき)
  if (d >= 12 && d <= 28) work(date, tozai, S03, '橋梁定期点検', 3, d === 12 ? '08:00' : '08:30', '17:30', {
    equipment: [['車両トラック', 1], ['規制材一式', 1]], noSlip: d === 20,
  })
}

// C002: 人工・20日締め・現場ごとの請求
const minato = ['C002', 'みなと土木株式会社']
const S10 = ['S10', '河川護岸工事']
for (let d = 21; d <= 30; d++) work(day(9, d), minato, S10, '工事車両誘導', 2, '08:00', '17:00')
for (let d = 1; d <= 25; d++) work(day(10, d), minato, S10, '工事車両誘導', 2, '08:00', '17:00')

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))
const csv = (rows) => '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
writeFileSync(new URL('./実績明細_202610.csv', import.meta.url), csv([RECORD_HEADER, ...records]))
writeFileSync(new URL('./機材明細_202610.csv', import.meta.url), csv([EQUIPMENT_HEADER, ...equipment]))
console.log(`実績 ${records.length} 行、機材 ${equipment.length} 行を書き出しました`)
