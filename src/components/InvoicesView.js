import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { buildInvoices } from '../lib/invoice';
import { breakdownsToCsv, downloadText, invoicesToCsv, issueDateOf } from '../lib/export';
import { yen } from '../lib/format';
import IssueList from './IssueList';
import CoverSheet from './CoverSheet';
import BreakdownSheet from './BreakdownSheet';
export default function InvoicesView({ records, equipment, masters, expenses, setExpenses, notes, setNotes, month, setMonth }) {
    /** 空なら各請求書の締め日を発行日にする */
    const [issueDate, setIssueDate] = useState('');
    const [selected, setSelected] = useState(null);
    const [printAll, setPrintAll] = useState(false);
    const { invoices, issues } = useMemo(() => buildInvoices(records, equipment, masters, month, expenses), [records, equipment, masters, month, expenses]);
    const current = invoices.find((i) => i.number === selected) ?? invoices[0];
    useEffect(() => {
        if (!printAll)
            return;
        const done = () => setPrintAll(false);
        window.addEventListener('afterprint', done, { once: true });
        window.print();
        return () => window.removeEventListener('afterprint', done);
    }, [printAll]);
    const companyMissing = !masters.company.name || !masters.company.registrationNo;
    const key = current?.expenseKey;
    const expenseLines = key ? expenses[key] ?? [] : [];
    const setExpenseLines = (lines) => {
        if (!key)
            return;
        const next = { ...expenses };
        if (lines.length > 0)
            next[key] = lines;
        else
            delete next[key];
        setExpenses(next);
    };
    const updateExpense = (id, patch) => setExpenseLines(expenseLines.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const yyyymm = month.replace('-', '');
    const grandTotal = invoices.reduce((s, i) => s + i.total, 0);
    const sheets = (inv) => (_jsxs("div", { className: "invoice-set", children: [_jsx(CoverSheet, { invoice: inv, company: masters.company, issueDate: issueDateOf(inv, issueDate), note: notes[inv.number] ?? '' }), inv.breakdowns.map((b) => (_jsx(BreakdownSheet, { breakdown: b, periodEnd: inv.period.to }, b.title)))] }, inv.number));
    return (_jsxs("section", { className: printAll ? 'print-all' : '', children: [_jsxs("div", { className: "no-print", children: [_jsx("h2", { children: "\u8ACB\u6C42\u66F8" }), _jsxs("div", { className: "toolbar", children: [_jsxs("label", { children: ["\u8ACB\u6C42\u6708 ", _jsx("input", { type: "month", value: month, onChange: (e) => e.target.value && setMonth(e.target.value) })] }), _jsxs("label", { children: ["\u767A\u884C\u65E5 ", _jsx("input", { type: "date", value: issueDate, onChange: (e) => setIssueDate(e.target.value) })] }), issueDate ? (_jsx("button", { onClick: () => setIssueDate(''), children: "\u7DE0\u3081\u65E5\u306B\u623B\u3059" })) : (_jsx("span", { className: "hint", children: "(\u672A\u6307\u5B9A\u306A\u3089\u5404\u8ACB\u6C42\u66F8\u306E\u7DE0\u3081\u65E5)" }))] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { disabled: !current, onClick: () => window.print(), children: "\u8868\u793A\u4E2D\u306E\u8ACB\u6C42\u66F8\u3092\u5370\u5237" }), _jsx("button", { disabled: invoices.length === 0, onClick: () => setPrintAll(true), children: "\u3059\u3079\u3066\u5370\u5237" }), _jsx("button", { className: "primary", disabled: invoices.length === 0, onClick: () => downloadText(`請求明細_${yyyymm}.csv`, invoicesToCsv(invoices, issueDate), 'text/csv'), children: "\u8ACB\u6C42\u660E\u7D30CSV" }), _jsx("button", { disabled: invoices.length === 0, onClick: () => downloadText(`内訳明細_${yyyymm}.csv`, breakdownsToCsv(invoices), 'text/csv'), children: "\u5185\u8A33\u660E\u7D30CSV" })] }), _jsx("p", { className: "hint", children: "\u5370\u5237\u753B\u9762\u3067\u300CPDF\u306B\u4FDD\u5B58\u300D\u3092\u9078\u3076\u3068PDF\u306B\u306A\u308A\u307E\u3059(\u8868\u7D19\u306FA4\u6A2A\u3001\u5185\u8A33\u66F8\u306FA4\u7E26)\u3002\u767A\u884C\u3057\u305F\u3089\u3001PDF\u3068\u8ACB\u6C42\u660E\u7D30CSV\u3092\u5171\u6709\u30D5\u30A9\u30EB\u30C0\u306B\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), companyMissing && _jsx("p", { className: "warn-text", children: "\u30DE\u30B9\u30BF\u306E\u81EA\u793E\u60C5\u5831(\u793E\u540D\u30FB\u767B\u9332\u756A\u53F7)\u304C\u672A\u5165\u529B\u3067\u3059\u3002" }), _jsx(IssueList, { issues: issues }), invoices.length === 0 ? (_jsx("p", { children: "\u3053\u306E\u8ACB\u6C42\u6708\u306B\u8ACB\u6C42\u3067\u304D\u308B\u5B9F\u7E3E\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u5B9F\u7E3E\u306E\u53D6\u308A\u8FBC\u307F\u3068\u30DE\u30B9\u30BF\u306E\u767B\u9332\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })) : (_jsxs("table", { className: "grid", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u8ACB\u6C42\u66F8\u756A\u53F7" }), _jsx("th", { children: "\u5143\u8ACB\u3051" }), _jsx("th", { children: "\u73FE\u5834" }), _jsx("th", { children: "\u5BFE\u8C61\u671F\u9593" }), _jsx("th", { children: "\u5B9F\u7E3E\u4EF6\u6570" }), _jsx("th", { children: "\u5185\u8A33\u66F8" }), _jsx("th", { children: "\u5408\u8A08(\u7A0E\u8FBC)" })] }) }), _jsxs("tbody", { children: [invoices.map((inv) => (_jsxs("tr", { className: inv.number === current?.number ? 'selected clickable' : 'clickable', onClick: () => setSelected(inv.number), children: [_jsx("td", { children: inv.number }), _jsx("td", { children: inv.client.name }), _jsx("td", { children: inv.siteName ?? (inv.isExpenseOnly ? '(経費)' : `${inv.coverLines.filter((l) => l.siteId).length} 現場`) }), _jsxs("td", { children: [inv.period.from, " \u301C ", inv.period.to] }), _jsx("td", { className: "num", children: inv.recordCount }), _jsxs("td", { className: "num", children: [inv.breakdowns.length, " \u679A"] }), _jsxs("td", { className: "num", children: ["\u00A5", yen(inv.total)] })] }, inv.number))), _jsxs("tr", { className: "sum", children: [_jsxs("td", { colSpan: 6, children: ["\u5408\u8A08 ", invoices.length, " \u4EF6"] }), _jsxs("td", { className: "num", children: ["\u00A5", yen(grandTotal)] })] })] })] })), current && (_jsxs("div", { className: "invoice-inputs", children: [_jsxs("div", { children: [_jsxs("h3", { children: ["\u7D4C\u8CBB(", key, current.client.expenseMode === 'separate' ? ` → 別の請求書 ${key}-E` : ' の表紙に追加', ")"] }), expenseLines.map((e) => (_jsxs("div", { className: "expense-row", children: [_jsx("input", { placeholder: "\u6458\u8981(\u4EA4\u901A\u8CBB\u30FB\u99D0\u8ECA\u5834\u4EE3\u306A\u3069)", value: e.description, onChange: (ev) => updateExpense(e.id, { description: ev.target.value }) }), _jsx("input", { className: "n", type: "number", value: e.amount, onChange: (ev) => updateExpense(e.id, { amount: Math.trunc(Number(ev.target.value) || 0) }) }), _jsx("span", { children: "\u5186(\u7A0E\u629C)" }), _jsxs("select", { value: e.taxRate, onChange: (ev) => updateExpense(e.id, { taxRate: Number(ev.target.value) }), children: [_jsx("option", { value: 10, children: "10%" }), _jsx("option", { value: 0, children: "\u5BFE\u8C61\u5916(\u7ACB\u66FF\u91D1\u306A\u3069)" })] }), _jsx("button", { className: "danger", onClick: () => setExpenseLines(expenseLines.filter((x) => x.id !== e.id)), children: "\u524A\u9664" })] }, e.id))), _jsx("button", { onClick: () => setExpenseLines([...expenseLines, { id: crypto.randomUUID(), description: '', amount: 0, taxRate: 10 }]), children: "\u7D4C\u8CBB\u3092\u8FFD\u52A0" })] }), _jsxs("div", { children: [_jsxs("h3", { children: ["\u5099\u8003(", current.number, ")"] }), _jsx("textarea", { rows: 3, value: notes[current.number] ?? '', onChange: (e) => {
                                            const next = { ...notes };
                                            if (e.target.value)
                                                next[current.number] = e.target.value;
                                            else
                                                delete next[current.number];
                                            setNotes(next);
                                        } })] })] }))] }), printAll ? invoices.map(sheets) : current && sheets(current)] }));
}
