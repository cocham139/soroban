// サンプルの実績明細CSV(架空データ)を作る: node sample/make-sample.mjs
import { writeFileSync } from 'node:fs'

const header = ['実績ID','勤務日','元請けID','元請け名','現場ID','現場名','ポストID','ポスト名','隊員ID','隊員名','勤務区分','開始','終了','休憩分','実働分','残業分','深夜分','休日フラグ','伝票番号','状態']
const staff = [['E001','山田'],['E002','佐藤'],['E003','鈴木'],['E004','高橋']]
const rows = []
let n = 0
const day = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`

function add(date, client, site, post, s, shift, opts = {}) {
  n++
  const night = shift === '夜勤'
  const work = 480 + (opts.ot ?? 0)
  rows.push([
    `R${date.replaceAll('-','')}-${String(n).padStart(4,'0')}`, date, ...client, ...site, ...post, ...s, shift,
    night ? '20:00' : '08:00', night ? (opts.ot ? '06:00' : '05:00') : (opts.ot ? `${17 + opts.ot / 60}:00` : '17:00'),
    60, work, opts.ot ?? 0, night ? 300 : 0, opts.holiday ? 1 : 0,
    opts.noSlip ? '' : `D-${1000 + n}`, opts.unconfirmed ? '未確定' : '確定',
  ])
}

const kita = ['C001','北辰建設株式会社']
const minato = ['C002','みなと土木株式会社']
// C001: 末日締め、2現場、日勤と夜勤
for (let d = 1; d <= 31; d++) {
  const date = day(2026, 10, d)
  const dow = new Date(2026, 9, d).getDay()
  if (dow === 0) continue
  const holiday = dow === 6
  add(date, kita, ['S01','駅前再開発ビル'], ['P1','正門'], staff[0], '日勤', { holiday, ot: d % 7 === 0 ? 60 : 0 })
  add(date, kita, ['S01','駅前再開発ビル'], ['P2','搬入口'], staff[1], '日勤', { holiday })
  if (d % 3 === 0) add(date, kita, ['S02','国道12号線改良'], ['P1','片側交互'], staff[2], '夜勤', { holiday })
}
// C002: 20日締め(9/21〜10/20 と 10/21 以降)
for (let d = 21; d <= 30; d++) add(day(2026, 9, d), minato, ['S10','河川護岸工事'], ['P1','工事車両出入口'], staff[3], '日勤')
for (let d = 1; d <= 25; d++) add(day(2026, 10, d), minato, ['S10','河川護岸工事'], ['P1','工事車両出入口'], staff[3], '日勤', {
  unconfirmed: d === 24, noSlip: d === 15,
})

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"','""')}"` : String(v))
const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
writeFileSync(new URL('./実績明細_202610.csv', import.meta.url), csv)
console.log(`${rows.length} 行を書き出しました`)
