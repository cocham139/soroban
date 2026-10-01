import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { emptyMasters, normalizeMasters } from './lib/masters';
import { useStoredState } from './lib/storage';
import ImportView from './components/ImportView';
import MastersView from './components/MastersView';
import InvoicesView from './components/InvoicesView';
/** 以前の版で保存した実績には職種・工事名がないので補う */
const normalizeRecords = (raw) => Array.isArray(raw) ? raw.map((r) => ({ ...r, jobType: r.jobType ?? '', work: r.work ?? '' })) : [];
const normalizeEquipment = (raw) => Array.isArray(raw) ? raw.map((e) => ({ ...e, source: e.source ?? 'csv' })) : [];
const TABS = [
    ['import', '1. 実績の取り込み'],
    ['masters', '2. マスタ'],
    ['invoices', '3. 請求書'],
];
export default function App() {
    const [tab, setTab] = useState('import');
    const [masters, setMasters] = useStoredState('soroban.masters', emptyMasters, normalizeMasters);
    const [records, setRecords] = useStoredState('soroban.records', () => [], normalizeRecords);
    const [equipment, setEquipment] = useStoredState('soroban.equipment', () => [], normalizeEquipment);
    const [expenses, setExpenses] = useStoredState('soroban.expenses', () => ({}));
    const [notes, setNotes] = useStoredState('soroban.notes', () => ({}));
    const [importIssues, setImportIssues] = useState([]);
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "app-header no-print", children: [_jsxs("h1", { children: [_jsx("button", { className: "app-title-link", onClick: () => setTab('import'), title: "\u6700\u521D\u306E\u753B\u9762\u306B\u623B\u308B", children: "SOROBAN" }), _jsx("span", { className: "app-header-tagline", children: "\u8ACB\u6C42\u66F8" })] }), _jsx("nav", { children: TABS.map(([key, label]) => (_jsx("button", { className: tab === key ? 'tab active' : 'tab', onClick: () => setTab(key), children: label }, key))) })] }), _jsxs("main", { children: [tab === 'import' && (_jsx(ImportView, { records: records, setRecords: setRecords, equipment: equipment, setEquipment: setEquipment, issues: importIssues, setIssues: setImportIssues, masters: masters })), tab === 'masters' && (_jsx(MastersView, { masters: masters, setMasters: setMasters, records: records, equipment: equipment })), tab === 'invoices' && (_jsx(InvoicesView, { records: records, equipment: equipment, masters: masters, expenses: expenses, setExpenses: setExpenses, notes: notes, setNotes: setNotes }))] })] }));
}
