/** RFC 4180 形式のCSVを2次元配列にする(ダブルクォート内のカンマ・改行に対応) */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                field += c;
            }
        }
        else if (c === '"') {
            inQuotes = true;
        }
        else if (c === ',') {
            row.push(field);
            field = '';
        }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && src[i + 1] === '\n')
                i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        }
        else {
            field += c;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((f) => f.trim() !== ''));
}
function escapeField(value) {
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Excelで文字化けしないよう UTF-8 BOM 付き・CRLF で出力する */
export function toCsv(rows) {
    return '﻿' + rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}
/** UTF-8 として読めなければ Shift_JIS として読む(Excelで保存し直したCSV対策) */
export function decodeBytes(bytes) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    catch {
        return new TextDecoder('shift_jis').decode(bytes);
    }
}
