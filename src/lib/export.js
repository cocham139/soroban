import { toCsv } from './csv';
/** 表紙の発行日。指定がなければ締め日(集計期間の最終日) */
export function issueDateOf(invoice, override) {
    return override || invoice.period.to;
}
export const INVOICE_CSV_HEADER = [
    '請求書番号',
    '発行日',
    '元請けID',
    '元請け名',
    '対象期間開始',
    '対象期間終了',
    '支払期限',
    '現場ID',
    '現場名',
    '仕様',
    '金額',
    '税率',
    '消費税',
];
/** 請求明細CSV。1行 = 表紙の明細1行(現場ごとの金額・経費)。会計ソフト向け変換の元データにもなる */
export function invoicesToCsv(invoices, issueDateOverride) {
    const rows = [[...INVOICE_CSV_HEADER]];
    for (const inv of invoices) {
        for (const l of inv.coverLines) {
            rows.push([
                inv.number,
                issueDateOf(inv, issueDateOverride),
                inv.client.id,
                inv.client.name,
                inv.period.from,
                inv.period.to,
                inv.dueDate,
                l.siteId ?? '',
                l.name.replace(/\s*\n\s*/g, ' '),
                l.spec,
                l.amount,
                `${l.taxRate}%`,
                l.tax,
            ]);
        }
    }
    return toCsv(rows);
}
export const BREAKDOWN_CSV_HEADER = [
    '請求書番号',
    '現場ID',
    '内訳書',
    '日付',
    '工事名',
    '時間',
    '項目',
    '数量',
    '単位',
    '単価',
    '金額',
];
/** 内訳明細CSV。1行 = 内訳書の1行 × 項目(日勤・夜勤・機材など) */
export function breakdownsToCsv(invoices) {
    const rows = [[...BREAKDOWN_CSV_HEADER]];
    for (const inv of invoices) {
        for (const b of inv.breakdowns) {
            for (const r of b.rows) {
                for (const c of b.columns) {
                    const q = r.quantities[c.key];
                    if (!q)
                        continue;
                    rows.push([inv.number, b.siteId, b.title, r.date, r.work, r.time, c.label, q, c.unit, c.unitPrice, r.amounts[c.key] ?? 0]);
                }
            }
        }
    }
    return toCsv(rows);
}
export function downloadText(fileName, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}
