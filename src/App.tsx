import { useState } from 'react'
import type { EquipmentRecord, ExpenseLine, Issue, WorkRecord } from './types'
import { emptyMasters, normalizeMasters } from './lib/masters'
import { useStoredState } from './lib/storage'
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
          />
        )}
      </main>
    </div>
  )
}
