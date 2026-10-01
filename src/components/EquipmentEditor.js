import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { monthDay } from '../lib/format';
const newId = () => `manual-${crypto.randomUUID()}`;
/**
 * 機材・車両の台数を確認・手入力する。
 * SHIRUBEの機材明細CSVがない場合や、CSVの台数を直したい場合に使う。
 */
export default function EquipmentEditor({ records, equipment, setEquipment, masters }) {
    const months = useMemo(() => [...new Set([...records, ...equipment].map((x) => x.date.slice(0, 7)))].sort().reverse(), [records, equipment]);
    const [month, setMonth] = useState('');
    const shownMonth = month || months[0] || '';
    const [form, setForm] = useState({ date: '', clientId: '', siteId: '', work: '', item: '', quantity: 1 });
    const set = (patch) => setForm({ ...form, ...patch });
    const clients = useMemo(() => {
        const m = new Map();
        for (const c of masters.clients)
            m.set(c.id, c.name);
        for (const r of records)
            if (!m.has(r.clientId))
                m.set(r.clientId, r.clientName);
        return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [masters.clients, records]);
    const siteNameOf = (clientId, siteId) => masters.sites.find((s) => s.clientId === clientId && s.siteId === siteId)?.coverName.replace(/\s*\n\s*/g, ' ') ||
        records.find((r) => r.clientId === clientId && r.siteId === siteId)?.siteName ||
        siteId;
    const sites = useMemo(() => {
        const ids = new Set();
        for (const r of records)
            if (r.clientId === form.clientId)
                ids.add(r.siteId);
        for (const s of masters.sites)
            if (s.clientId === form.clientId)
                ids.add(s.siteId);
        return [...ids].sort();
    }, [records, masters.sites, form.clientId]);
    const works = [
        ...new Set(records
            .filter((r) => r.clientId === form.clientId && r.siteId === form.siteId && (!form.date || r.date === form.date))
            .map((r) => r.work)),
    ];
    const items = [
        ...new Set([
            ...masters.equipmentRates.filter((r) => r.clientId === form.clientId).map((r) => r.item),
            ...equipment.filter((e) => e.clientId === form.clientId).map((e) => e.item),
        ]),
    ].filter(Boolean);
    const ready = form.clientId && form.siteId && form.item && form.quantity > 0;
    const make = (date, work) => ({
        id: newId(),
        date,
        clientId: form.clientId,
        siteId: form.siteId,
        work,
        item: form.item,
        quantity: form.quantity,
        slipNo: '',
        source: 'manual',
    });
    const exists = (date, work) => equipment.some((e) => e.clientId === form.clientId && e.siteId === form.siteId && e.item === form.item && e.date === date && e.work === work);
    function addOne() {
        if (!ready || !form.date)
            return;
        setEquipment([...equipment, make(form.date, form.work)]);
    }
    /** この現場に実績がある日(工事名を指定したらその工事名の日)すべてに追加する */
    function addForWorkedDays() {
        if (!ready)
            return;
        const dates = [
            ...new Set(records
                .filter((r) => r.clientId === form.clientId &&
                r.siteId === form.siteId &&
                r.date.startsWith(shownMonth) &&
                (!form.work || r.work === form.work))
                .map((r) => r.date)),
        ].sort();
        const toAdd = dates.filter((d) => !exists(d, form.work)).map((d) => make(d, form.work));
        if (toAdd.length === 0) {
            alert('追加できる日がありません(実績がないか、すでに登録済みです)');
            return;
        }
        if (confirm(`${shownMonth} の実績がある ${toAdd.length} 日分に「${form.item} ${form.quantity}台」を追加します。よろしいですか?`)) {
            setEquipment([...equipment, ...toAdd]);
        }
    }
    const shown = equipment
        .filter((e) => e.date.startsWith(shownMonth) && (!form.clientId || e.clientId === form.clientId))
        .sort((a, b) => a.date.localeCompare(b.date) || a.siteId.localeCompare(b.siteId) || a.item.localeCompare(b.item, 'ja'));
    const update = (id, patch) => setEquipment(equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    return (_jsxs("div", { className: "equipment-editor", children: [_jsx("h3", { children: "\u6A5F\u6750\u30FB\u8ECA\u4E21" }), _jsx("p", { className: "hint", children: "SHIRUBE\u306E\u6A5F\u6750\u660E\u7D30CSV\u3092\u53D6\u308A\u8FBC\u3080\u304B\u3001\u3053\u3053\u3067\u624B\u5165\u529B\u3057\u307E\u3059\u3002\u5DE5\u4E8B\u540D\u3092\u7A7A\u306B\u3059\u308B\u3068\u3001\u305D\u306E\u65E5\u306E\u5185\u8A33\u66F8\u306E\u6700\u521D\u306E\u884C\u306B\u8F09\u308A\u307E\u3059\u3002" }), _jsxs("div", { className: "equipment-form", children: [_jsxs("label", { children: ["\u52E4\u52D9\u65E5", _jsx("input", { type: "date", value: form.date, onChange: (e) => set({ date: e.target.value }) })] }), _jsxs("label", { children: ["\u5143\u8ACB\u3051", _jsxs("select", { value: form.clientId, onChange: (e) => set({ clientId: e.target.value, siteId: '', work: '' }), children: [_jsx("option", { value: "", children: "(\u9078\u629E)" }), clients.map(([id, name]) => _jsxs("option", { value: id, children: [id, " ", name] }, id))] })] }), _jsxs("label", { children: ["\u73FE\u5834", _jsxs("select", { value: form.siteId, onChange: (e) => set({ siteId: e.target.value, work: '' }), children: [_jsx("option", { value: "", children: "(\u9078\u629E)" }), sites.map((id) => _jsxs("option", { value: id, children: [id, " ", siteNameOf(form.clientId, id)] }, id))] })] }), _jsxs("label", { children: ["\u5DE5\u4E8B\u540D(\u4EFB\u610F)", _jsx("input", { list: "equipment-works", value: form.work, onChange: (e) => set({ work: e.target.value }) }), _jsx("datalist", { id: "equipment-works", children: works.map((w) => _jsx("option", { value: w }, w)) })] }), _jsxs("label", { children: ["\u54C1\u76EE", _jsx("input", { list: "equipment-items", value: form.item, placeholder: "\u8ECA\u4E21\u30C8\u30E9\u30C3\u30AF", onChange: (e) => set({ item: e.target.value }) }), _jsx("datalist", { id: "equipment-items", children: items.map((i) => _jsx("option", { value: i }, i)) })] }), _jsxs("label", { children: ["\u6570\u91CF", _jsx("input", { className: "n", type: "number", min: 1, value: form.quantity, onChange: (e) => set({ quantity: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }) })] }), _jsxs("div", { className: "buttons", children: [_jsx("button", { className: "primary", disabled: !ready || !form.date, onClick: addOne, children: "\u3053\u306E\u65E5\u306B\u8FFD\u52A0" }), _jsxs("button", { disabled: !ready || !shownMonth, onClick: addForWorkedDays, children: [shownMonth || '—', " \u306E\u5B9F\u7E3E\u304C\u3042\u308B\u65E5\u3059\u3079\u3066\u306B\u8FFD\u52A0"] })] })] }), _jsxs("div", { className: "toolbar", children: [_jsxs("label", { children: ["\u8868\u793A\u3059\u308B\u6708", _jsxs("select", { value: shownMonth, onChange: (e) => setMonth(e.target.value), children: [months.length === 0 && _jsx("option", { value: "", children: "(\u30C7\u30FC\u30BF\u306A\u3057)" }), months.map((m) => _jsx("option", { value: m, children: m }, m))] })] }), _jsxs("span", { className: "hint", children: [shown.length, " \u4EF6", form.clientId && `(${form.clientId} のみ表示中。元請けの選択を外すと全件)`] })] }), shown.length > 0 && (_jsx("div", { className: "scroll", children: _jsxs("table", { className: "grid edit", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u65E5\u4ED8" }), _jsx("th", { children: "\u5143\u8ACB\u3051" }), _jsx("th", { children: "\u73FE\u5834" }), _jsx("th", { children: "\u5DE5\u4E8B\u540D" }), _jsx("th", { children: "\u54C1\u76EE" }), _jsx("th", { children: "\u6570\u91CF" }), _jsx("th", { children: "\u5165\u529B\u5143" }), _jsx("th", {})] }) }), _jsx("tbody", { children: shown.map((e) => (_jsxs("tr", { children: [_jsx("td", { className: "nowrap", children: monthDay(e.date) }), _jsx("td", { children: e.clientId }), _jsx("td", { children: siteNameOf(e.clientId, e.siteId) }), _jsx("td", { children: _jsx("input", { value: e.work, placeholder: "(\u305D\u306E\u65E5\u306E\u6700\u521D\u306E\u884C)", onChange: (ev) => update(e.id, { work: ev.target.value }) }) }), _jsx("td", { children: e.item }), _jsx("td", { children: _jsx("input", { className: "n", type: "number", min: 0, value: e.quantity, onChange: (ev) => update(e.id, { quantity: Math.max(0, Math.trunc(Number(ev.target.value) || 0)) }) }) }), _jsx("td", { children: e.source === 'manual' ? '手入力' : 'CSV' }), _jsx("td", { children: _jsx("button", { className: "danger", onClick: () => setEquipment(equipment.filter((x) => x.id !== e.id)), children: "\u524A\u9664" }) })] }, e.id))) })] }) }))] }));
}
