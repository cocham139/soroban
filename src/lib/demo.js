import { parseMasters } from './masters';
import { parseEquipment, parseWorkRecords } from './records';
import mastersJson from '../../sample/soroban-masters_sample.json?raw';
import recordsCsv from '../../sample/実績明細_202610.csv?raw';
import equipmentCsv from '../../sample/機材明細_202610.csv?raw';
/** デモデータの請求月(sample/ のCSVと同じ月) */
export const DEMO_MONTH = '2026-10';
/** sample/ にある架空の1か月分(マスタ・実績・機材)を読み込む */
export function loadDemo() {
    return {
        masters: parseMasters(mastersJson),
        records: parseWorkRecords(recordsCsv, '実績明細_202610.csv').records,
        equipment: parseEquipment(equipmentCsv, '機材明細_202610.csv').equipment,
    };
}
