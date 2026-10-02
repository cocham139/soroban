import { useState } from 'react'
import type { EquipmentRecord, ExpenseLine, Issue, WorkRecord } from './types'
import { emptyMasters, normalizeMasters } from './lib/masters'
import { useStoredState } from './lib/storage'
import { previousMonth } from './lib/period'
import { DEMO_MONTH, loadDemo } from './lib/demo'
import ImportView from './components/ImportView'
import MastersView from './components/MastersView'
import InvoicesView from './components/InvoicesView'

type Tab = 'import' | 'masters' | 'invoices'

/** 以前の版で保存した実績には職種・工事名がないので補う */
const normalizeRecords = (raw: unknown): WorkRecord[] =>
  Array.isArray(raw) ? raw.map((r: WorkRecord) => ({ ...r, jobType: r.jobType ?? '', work: r.work ?? '' })) : []
const normalizeEquipment = (raw: unknown): EquipmentRecord[] =>
  Array.isArray(raw) ? raw.map((e: EquipmentRecord) => ({ ...e, source: e.source ?? 'csv' })) : []

const TABS: [Tab, string][] = [
  ['import', '1. 実績の取り込み'],
  ['masters', '2. マスタ'],
  ['invoices', '3. 請求書'],
]

export default function App() {
  const [tab, setTab] = useState<Tab>('import')
  const [masters, setMasters] = useStoredState('soroban.masters', emptyMasters, normalizeMasters)
  const [records, setRecords] = useStoredState<WorkRecord[]>('soroban.records', () => [], normalizeRecords)
  const [equipment, setEquipment] = useStoredState<EquipmentRecord[]>('soroban.equipment', () => [], normalizeEquipment)
  const [expenses, setExpenses] = useStoredState<Record<string, ExpenseLine[]>>('soroban.expenses', () => ({}))
  const [notes, setNotes] = useStoredState<Record<string, string>>('soroban.notes', () => ({}))
  const [importIssues, setImportIssues] = useState<Issue[]>([])
  const [month, setMonth] = useState(() => previousMonth(new Date()))

  /** 架空の1か月分(マスタ・実績・機材)に置き換えて、請求書の画面を開く */
  function startDemo() {
    const hasData = records.length + equipment.length + masters.clients.length > 0
    if (
      hasData &&
      !confirm('今のマスタと取り込んだデータを、デモ用のデータ(架空の1か月分)に置き換えます。\n実際のマスタを入力済みの場合は、先に「マスタを書き出す」で保存してください。\n\n置き換えてよろしいですか?')
    )
      return
    const demo = loadDemo()
    setMasters(demo.masters)
    setRecords(demo.records)
    setEquipment(demo.equipment)
    setExpenses({})
    setNotes({})
    setImportIssues([
      { level: 'info', message: `デモデータ(架空の1か月分)を入れました: 実績 ${demo.records.length} 件 / 機材 ${demo.equipment.length} 件` },
    ])
    setMonth(DEMO_MONTH)
    setTab('invoices')
  }

  return (
    <div className="app">
      <header className="app-header no-print">
        <h1>
          <button className="app-title-link" onClick={() => setTab('import')} title="最初の画面に戻る">
            SOROBAN
          </button>
          <span className="app-header-tagline">請求書</span>
        </h1>
        <nav>
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'import' && (
          <ImportView
            records={records}
            setRecords={setRecords}
            equipment={equipment}
            setEquipment={setEquipment}
            issues={importIssues}
            setIssues={setImportIssues}
            masters={masters}
            onDemo={startDemo}
          />
        )}
        {tab === 'masters' && (
          <MastersView masters={masters} setMasters={setMasters} records={records} equipment={equipment} />
        )}
        {tab === 'invoices' && (
          <InvoicesView
            records={records}
            equipment={equipment}
            masters={masters}
            expenses={expenses}
            setExpenses={setExpenses}
            notes={notes}
            setNotes={setNotes}
            month={month}
            setMonth={setMonth}
          />
        )}
      </main>
    </div>
  )
}
