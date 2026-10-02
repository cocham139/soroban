import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { decodeBytes } from '../lib/csv';
import { parseAnyCsv } from '../lib/records';
import IssueList from './IssueList';
import EquipmentEditor from './EquipmentEditor';
export default function ImportView({ records, setRecords, equipment, setEquipment, issues, setIssues, masters, onDemo }) {
    async function onFiles(files) {
        if (files.length === 0)
            return;
        let allRecords = records;
        let allEquipment = equipment;
        const newIssues = [];
        for (const file of files) {
            const text = decodeBytes(new Uint8Array(await file.arrayBuffer()));
            const result = parseAnyCsv(text, file.name, {
                recordIds: new Set(allRecords.map((r) => r.id)),
                equipmentIds: new Set(allEquipment.map((e) => e.id)),
            });
            allRecords = [...allRecords, ...result.records];
            allEquipment = [...allEquipment, ...result.equipment];
            if (result.kind) {
                const count = result.kind === 'records' ? result.records.length : result.equipment.length;
                const label = result.kind === 'records' ? '実績' : '機材';
                newIssues.push({ level: 'info', message: `${file.name}: ${label} ${count} 件を取り込みました` });
            }
            newIssues.push(...result.issues);
        }
        setRecords(allRecords);
        setEquipment(allEquipment);
        setIssues(newIssues);
    }
    function clear() {
        if (!confirm('取り込んだ実績・機材(手入力した機材も含む)をすべて消します。よろしいですか?'))
            return;
        setRecords([]);
        setEquipment([]);
        setIssues([]);
    }
    const byClient = new Map();
    const touch = (clientId, date, name = '') => {
        const s = byClient.get(clientId) ?? { name, count: 0, equipment: 0, from: date, to: date };
        if (!s.name)
            s.name = name;
        if (date < s.from)
            s.from = date;
        if (date > s.to)
            s.to = date;
        byClient.set(clientId, s);
        return s;
    };
    for (const r of records)
        touch(r.clientId, r.date, r.clientName).count++;
    for (const e of equipment)
        touch(e.clientId, e.date).equipment++;
    return (_jsxs("section", { children: [_jsx("h2", { children: "SHIRUBE\u306ECSV\u3092\u53D6\u308A\u8FBC\u3080" }), _jsx("p", { className: "hint", children: "\u5B9F\u7E3E\u660E\u7D30CSV\u3068\u6A5F\u6750\u660E\u7D30CSV\u3092\u3001\u307E\u3068\u3081\u3066\u9078\u3079\u307E\u3059(\u7A2E\u985E\u306F\u81EA\u52D5\u3067\u5224\u5225\u3057\u307E\u3059)\u3002 20\u65E5\u7DE0\u3081\u306A\u3069\u6708\u3092\u307E\u305F\u3050\u5143\u8ACB\u3051\u306F\u30012\u304B\u6708\u5206\u3092\u53D6\u308A\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\u3002UTF-8\u30FBShift_JIS \u306E\u3069\u3061\u3089\u3067\u3082\u8AAD\u3081\u307E\u3059\u3002 \u30C7\u30FC\u30BF\u306F\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306E\u4E2D\u3060\u3051\u3067\u51E6\u7406\u3055\u308C\u3001\u5916\u90E8\u306B\u306F\u9001\u3089\u308C\u307E\u305B\u3093\u3002 \u306F\u3058\u3081\u3066\u306E\u65B9\u306F\u300C\u30C7\u30E2\u30C7\u30FC\u30BF\u3092\u5165\u308C\u308B\u300D\u3067\u3001\u67B6\u7A7A\u306E1\u304B\u6708\u5206\u306E\u8ACB\u6C42\u66F8\u3092\u8A66\u305B\u307E\u3059\u3002" }), _jsxs("div", { className: "toolbar", children: [_jsxs("label", { className: "button primary", children: ["CSV\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u3076", _jsx("input", { type: "file", accept: ".csv,text/csv", multiple: true, hidden: true, onChange: (e) => {
                                    // value を空にすると FileList も空になるので、先に配列へ写す
                                    const files = Array.from(e.target.files ?? []);
                                    e.target.value = '';
                                    void onFiles(files);
                                } })] }), records.length + equipment.length > 0 && _jsx("button", { onClick: clear, children: "\u53D6\u308A\u8FBC\u3093\u3060\u30C7\u30FC\u30BF\u3092\u6D88\u3059" }), _jsx("button", { onClick: onDemo, children: "\u30C7\u30E2\u30C7\u30FC\u30BF\u3092\u5165\u308C\u308B(1\u304B\u6708\u5206)" })] }), _jsx(IssueList, { issues: issues }), _jsxs("h3", { children: ["\u53D6\u308A\u8FBC\u307F\u6E08\u307F: \u5B9F\u7E3E ", records.length, " \u4EF6 / \u6A5F\u6750 ", equipment.length, " \u4EF6"] }), byClient.size > 0 && (_jsxs("table", { className: "grid", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u5143\u8ACB\u3051ID" }), _jsx("th", { children: "\u5143\u8ACB\u3051\u540D" }), _jsx("th", { children: "\u5B9F\u7E3E" }), _jsx("th", { children: "\u6A5F\u6750" }), _jsx("th", { children: "\u52E4\u52D9\u65E5\u306E\u7BC4\u56F2" })] }) }), _jsx("tbody", { children: [...byClient.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, s]) => (_jsxs("tr", { children: [_jsx("td", { children: id }), _jsx("td", { children: s.name }), _jsx("td", { className: "num", children: s.count }), _jsx("td", { className: "num", children: s.equipment }), _jsxs("td", { children: [s.from, " \u301C ", s.to] })] }, id))) })] })), _jsx(EquipmentEditor, { records: records, equipment: equipment, setEquipment: setEquipment, masters: masters })] }));
}
