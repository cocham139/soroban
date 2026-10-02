import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { emptyMasters, normalizeMasters } from './lib/masters';
import { useStoredState } from './lib/storage';
import { previousMonth } from './lib/period';
import { DEMO_MONTH, loadDemo } from './lib/demo';
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
    const [month, setMonth] = useState(() => previousMonth(new Date()));
    /** 架空の1か月分(マスタ・実績・機材)に置き換えて、請求書の画面を開く */
    function startDemo() {
        const hasData = records.length + equipment.length + masters.clients.length > 0;
        if (hasData &&
            !confirm('今のマスタと取り込んだデータを、デモ用のデータ(架空の1か月分)に置き換えます。\n実際のマスタを入力済みの場合は、先に「マスタを書き出す」で保存してください。\n\n置き換えてよろしいですか?'))
            return;
        const demo = loadDemo();
        setMasters(demo.masters);
        setRecords(demo.records);
        setEquipment(demo.equipment);
        setExpenses({});
        setNotes({});
        setImportIssues([
            { level: 'info', message: `デモデータ(架空の1か月分)を入れました: 実績 ${demo.records.length} 件 / 機材 ${demo.equipment.length} 件` },
        ]);
        setMonth(DEMO_MONTH);
        setTab('invoices');
    }
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "app-header no-print", children: [_jsxs("h1", { children: [_jsx("button", { className: "app-title-link", onClick: () => setTab('import'), title: "\u6700\u521D\u306E\u753B\u9762\u306B\u623B\u308B", children: "SOROBAN" }), _jsx("span", { className: "app-header-tagline", children: "\u8ACB\u6C42\u66F8" })] }), _jsx("nav", { children: TABS.map(([key, label]) => (_jsx("button", { className: tab === key ? 'tab active' : 'tab', onClick: () => setTab(key), children: label }, key))) })] }), _jsxs("main", { children: [tab === 'import' && (_jsx(ImportView, { records: records, setRecords: setRecords, equipment: equipment, setEquipment: setEquipment, issues: importIssues, setIssues: setImportIssues, masters: masters, onDemo: startDemo })), tab === 'masters' && (_jsx(MastersView, { masters: masters, setMasters: setMasters, records: records, equipment: equipment })), tab === 'invoices' && (_jsx(InvoicesView, { records: records, equipment: equipment, masters: masters, expenses: expenses, setExpenses: setExpenses, notes: notes, setNotes: setNotes, month: month, setMonth: setMonth }))] })] }));
}
