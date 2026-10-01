import { parseCsv } from './csv';
const col = (label, key, required = true, aliases = []) => ({
    label,
    key,
    required,
    aliases,
});
/** SHIRUBE 実績明細CSVの列(ヘッダーは日本語固定。順番は問わない) */
export const RECORD_COLUMNS = [
    col('実績ID', 'id'),
    col('勤務日', 'date'),
    col('元請けID', 'clientId'),
    col('元請け名', 'clientName', false),
    col('現場ID', 'siteId'),
    col('現場名', 'siteName', false),
    col('ポストID', 'postId', false),
    col('ポスト名', 'postName', false),
    col('隊員ID', 'staffId', false),
    col('隊員名', 'staffName', false),
    col('職種', 'jobType', false),
    col('工事名', 'work', false, ['作業内容']),
    col('勤務区分', 'shiftType'),
    col('開始', 'start'),
    col('終了', 'end'),
    col('休憩分', 'breakMinutes'),
    col('実働分', 'workMinutes'),
    col('残業分', 'overtimeMinutes', false),
    col('伝票番号', 'slipNo', false),
    col('状態', 'confirmed'),
];
/** SHIRUBE 機材明細CSVの列 */
export const EQUIPMENT_COLUMNS = [
    col('機材明細ID', 'id'),
    col('勤務日', 'date'),
    col('元請けID', 'clientId'),
    col('現場ID', 'siteId'),
    col('工事名', 'work', false, ['作業内容']),
    col('品目', 'item'),
    col('数量', 'quantity'),
    col('伝票番号', 'slipNo', false),
];
function readTable(text, fileName, columns) {
    const rows = parseCsv(text);
    const header = (rows[0] ?? []).map((h) => h.trim());
    const index = new Map();
    const missing = [];
    for (const c of columns) {
        const i = [c.label, ...(c.aliases ?? [])].map((l) => header.indexOf(l)).find((x) => x !== -1) ?? -1;
        if (i !== -1)
            index.set(c.key, i);
        else if (c.required)
            missing.push(c.label);
    }
    if (missing.length > 0) {
        throw new Error(`${fileName}: 列が足りません(${missing.join('、')})`);
    }
    return rows.slice(1).map((row) => (key) => {
        const i = index.get(key);
        return i === undefined ? '' : (row[i] ?? '').trim();
    });
}
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
const minutes = (raw) => (raw === '' ? 0 : Number(raw));
const isNonNegativeInt = (n) => Number.isInteger(n) && n >= 0;
/** ヘッダーから実績明細か機材明細かを判別する */
export function detectKind(text) {
    const header = (parseCsv(text.split(/\r?\n/, 1)[0] ?? '')[0] ?? []).map((h) => h.trim());
    if (header.includes('機材明細ID'))
        return 'equipment';
    if (header.includes('実績ID'))
        return 'records';
    return null;
}
function preview(ids) {
    return ids.length <= 3 ? ids.join('、') : `${ids.slice(0, 3).join('、')} ほか`;
}
/**
 * 実績明細CSVを読み込み、検証する。
 * 形式が壊れている行は取り込まない(error)。未確定・伝票番号なし・重複は警告(warn)。
 * existingIds を渡すと、既に取り込み済みの実績IDとの重複も検知する。
 */
export function parseWorkRecords(text, fileName, existingIds = new Set()) {
    const result = { kind: 'records', records: [], equipment: [], issues: [] };
    let rows;
    try {
        rows = readTable(text, fileName, RECORD_COLUMNS);
    }
    catch (e) {
        result.issues.push({ level: 'error', message: e.message });
        return result;
    }
    const seen = new Set(existingIds);
    const unconfirmed = [];
    const noSlip = [];
    const duplicated = [];
    rows.forEach((get, i) => {
        const problems = [];
        const id = get('id');
        if (!id)
            problems.push('実績IDが空');
        if (!isDate(get('date')))
            problems.push(`勤務日「${get('date')}」`);
        if (!get('clientId'))
            problems.push('元請けIDが空');
        if (!get('siteId'))
            problems.push('現場IDが空');
        if (!get('shiftType'))
            problems.push('勤務区分が空');
        for (const k of ['start', 'end']) {
            if (!isTime(get(k)))
                problems.push(`${k === 'start' ? '開始' : '終了'}「${get(k)}」`);
        }
        const breakMinutes = minutes(get('breakMinutes'));
        const workMinutes = minutes(get('workMinutes'));
        const overtimeMinutes = minutes(get('overtimeMinutes'));
        if (!isNonNegativeInt(breakMinutes))
            problems.push(`休憩分「${get('breakMinutes')}」`);
        if (!isNonNegativeInt(workMinutes))
            problems.push(`実働分「${get('workMinutes')}」`);
        if (!isNonNegativeInt(overtimeMinutes))
            problems.push(`残業分「${get('overtimeMinutes')}」`);
        else if (overtimeMinutes > workMinutes)
            problems.push('残業分が実働分より多い');
        const status = get('confirmed');
        if (status !== '確定' && status !== '未確定')
            problems.push(`状態「${status}」`);
        if (problems.length > 0) {
            result.issues.push({
                level: 'error',
                message: `${fileName} ${i + 2}行目: ${problems.join('、')} のため取り込みませんでした`,
            });
            return;
        }
        if (seen.has(id)) {
            duplicated.push(id);
            return;
        }
        seen.add(id);
        const record = {
            id,
            date: get('date'),
            clientId: get('clientId'),
            clientName: get('clientName'),
            siteId: get('siteId'),
            siteName: get('siteName') || get('siteId'),
            postId: get('postId'),
            postName: get('postName'),
            staffId: get('staffId'),
            staffName: get('staffName'),
            jobType: get('jobType'),
            // 工事名がなければ現場名を使う(内訳書の「工事名」欄が空にならないように)
            work: get('work') || get('siteName'),
            shiftType: get('shiftType'),
            start: get('start').padStart(5, '0'),
            end: get('end').padStart(5, '0'),
            breakMinutes,
            workMinutes,
            overtimeMinutes,
            slipNo: get('slipNo'),
            confirmed: status === '確定',
        };
        if (!record.confirmed)
            unconfirmed.push(id);
        if (!record.slipNo)
            noSlip.push(id);
        result.records.push(record);
    });
    if (duplicated.length > 0) {
        result.issues.push({
            level: 'warn',
            message: `${fileName}: 実績IDが重複している ${duplicated.length} 件は取り込みませんでした(${preview(duplicated)})`,
        });
    }
    if (unconfirmed.length > 0) {
        result.issues.push({
            level: 'warn',
            message: `${fileName}: 未確定の実績が ${unconfirmed.length} 件あります(${preview(unconfirmed)})`,
        });
    }
    if (noSlip.length > 0) {
        result.issues.push({
            level: 'warn',
            message: `${fileName}: 伝票番号が空の実績が ${noSlip.length} 件あります(${preview(noSlip)})`,
        });
    }
    return result;
}
/** 機材明細CSVを読み込み、検証する */
export function parseEquipment(text, fileName, existingIds = new Set()) {
    const result = { kind: 'equipment', records: [], equipment: [], issues: [] };
    let rows;
    try {
        rows = readTable(text, fileName, EQUIPMENT_COLUMNS);
    }
    catch (e) {
        result.issues.push({ level: 'error', message: e.message });
        return result;
    }
    const seen = new Set(existingIds);
    const duplicated = [];
    rows.forEach((get, i) => {
        const problems = [];
        const id = get('id');
        if (!id)
            problems.push('機材明細IDが空');
        if (!isDate(get('date')))
            problems.push(`勤務日「${get('date')}」`);
        if (!get('clientId'))
            problems.push('元請けIDが空');
        if (!get('siteId'))
            problems.push('現場IDが空');
        if (!get('item'))
            problems.push('品目が空');
        const quantity = Number(get('quantity'));
        if (!isNonNegativeInt(quantity))
            problems.push(`数量「${get('quantity')}」`);
        if (problems.length > 0) {
            result.issues.push({
                level: 'error',
                message: `${fileName} ${i + 2}行目: ${problems.join('、')} のため取り込みませんでした`,
            });
            return;
        }
        if (seen.has(id)) {
            duplicated.push(id);
            return;
        }
        seen.add(id);
        result.equipment.push({
            id,
            date: get('date'),
            clientId: get('clientId'),
            siteId: get('siteId'),
            work: get('work'),
            item: get('item'),
            quantity,
            slipNo: get('slipNo'),
            source: 'csv',
        });
    });
    if (duplicated.length > 0) {
        result.issues.push({
            level: 'warn',
            message: `${fileName}: 機材明細IDが重複している ${duplicated.length} 件は取り込みませんでした(${preview(duplicated)})`,
        });
    }
    return result;
}
/** ヘッダーで種類を判別して読み込む */
export function parseAnyCsv(text, fileName, existing) {
    const kind = detectKind(text);
    if (kind === 'records')
        return parseWorkRecords(text, fileName, existing.recordIds);
    if (kind === 'equipment')
        return parseEquipment(text, fileName, existing.equipmentIds);
    return {
        kind: null,
        records: [],
        equipment: [],
        issues: [
            {
                level: 'error',
                message: `${fileName}: 実績明細(「実績ID」列)でも機材明細(「機材明細ID」列)でもありません`,
            },
        ],
    };
}
