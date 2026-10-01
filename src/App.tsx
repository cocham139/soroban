import { useState } from 'react'
import type { ExpenseLine, Issue, WorkRecord } from './types'
import { emptyMasters } from './lib/masters'
import { useStoredState } from './lib/storage'
import ImportView from './components/ImportView'
import MastersView from './components/MastersView'
import InvoicesView from './components/InvoicesView'

type Tab = 'import' | 'masters' | 'invoices'

const TABS: [Tab, string][] = [
  ['import', '1. 実績の取り込み'],
  ['masters', '2. マスタ'],
  ['invoices', '3. 請求書'],
]

export default function App() {
  const [tab, setTab] = useState<Tab>('import')
  const [masters, setMasters] = useStoredState('soroban.masters', emptyMasters)
  const [records, setRecords] = useStoredState<WorkRecord[]>('soroban.records', () => [])
  const [expenses, setExpenses] = useStoredState<Record<string, ExpenseLine[]>>('soroban.expenses', () => ({}))
  const [importIssues, setImportIssues] = useState<Issue[]>([])

  return (
    <div className="app">
      <header className="app-header no-print">
        <h1>SOROBAN</h1>
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
            issues={importIssues}
            setIssues={setImportIssues}
          />
        )}
        {tab === 'masters' && <MastersView masters={masters} setMasters={setMasters} records={records} />}
        {tab === 'invoices' && (
          <InvoicesView records={records} masters={masters} expenses={expenses} setExpenses={setExpenses} />
        )}
      </main>
    </div>
  )
}
