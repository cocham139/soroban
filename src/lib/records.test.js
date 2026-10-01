import { describe, expect, it } from 'vitest';
import { EQUIPMENT_COLUMNS, RECORD_COLUMNS, detectKind, parseAnyCsv, parseEquipment, parseWorkRecords } from './records';
const header = RECORD_COLUMNS.map((c) => c.label).join(',');
const BASE = {
    実績ID: 'R1', 勤務日: '2026-10-01', 元請けID: 'C001', 元請け名: '○○建設',
    現場ID: 'S01', 現場名: 'Aビル', ポストID: 'P1', ポスト名: '正門',
    隊員ID: 'E1', 隊員名: '山田', 職種: '規制保安員', 工事名: '舗装補修',
    勤務区分: '日勤', 開始: '08:00', 終了: '17:00',
    休憩分: '60', 実働分: '480', 残業分: '0', 伝票番号: 'D-1', 状態: '確定',
};
const row = (o = {}) => RECORD_COLUMNS.map((c) => ({ ...BASE, ...o })[c.label]).join(',');
describe('parseWorkRecords', () => {
    it('正しい行を取り込む', () => {
        const { records, issues } = parseWorkRecords(`${header}\n${row()}`, 'a.csv');
        expect(issues).toEqual([]);
        expect(records[0]).toMatchObject({ id: 'R1', jobType: '規制保安員', work: '舗装補修', workMinutes: 480, confirmed: true });
    });
    it('必須の列が足りなければエラー', () => {
        const { records, issues } = parseWorkRecords('実績ID,勤務日\nR1,2026-10-01', 'a.csv');
        expect(records).toEqual([]);
        expect(issues[0].message).toContain('元請けID');
    });
    it('任意の列(職種・作業内容・残業分など)はなくても読める', () => {
        const optional = ['元請け名', '現場名', 'ポストID', 'ポスト名', '隊員ID', '隊員名', '職種', '工事名', '残業分', '伝票番号'];
        const cols = RECORD_COLUMNS.filter((c) => !optional.includes(c.label));
        const text = `${cols.map((c) => c.label).join(',')}\n${cols.map((c) => BASE[c.label]).join(',')}`;
        const { records, issues } = parseWorkRecords(text, 'a.csv');
        expect(records[0]).toMatchObject({ jobType: '', work: '', overtimeMinutes: 0, siteName: 'S01' });
        expect(issues.map((i) => i.level)).toEqual(['warn']); // 伝票番号なし
    });
    it('列の順番が違っても読める', () => {
        const labels = RECORD_COLUMNS.map((c) => c.label).reverse();
        const { records } = parseWorkRecords(`${labels.join(',')}\n${labels.map((l) => BASE[l]).join(',')}`, 'a.csv');
        expect(records[0].id).toBe('R1');
    });
    it('形式が壊れた行は取り込まずエラーにする', () => {
        const text = [header, row({ 実働分: '7.5' }), row({ 実績ID: 'R2', 勤務日: '10/1' }), row({ 実績ID: 'R3', 開始: '25:00' })].join('\n');
        const { records, issues } = parseWorkRecords(text, 'a.csv');
        expect(records).toEqual([]);
        expect(issues.filter((i) => i.level === 'error')).toHaveLength(3);
    });
    it('「作業内容」の列名でも工事名として読む。工事名が空なら現場名を使う', () => {
        const text = header.replace('工事名', '作業内容') + '\n' + row() + '\n' + row({ 実績ID: 'R2', 工事名: '' });
        const { records } = parseWorkRecords(text, 'a.csv');
        expect(records.map((r) => r.work)).toEqual(['舗装補修', 'Aビル']);
    });
    it('時刻の0埋めをそろえる', () => {
        const { records } = parseWorkRecords(`${header}\n${row({ 開始: '8:30' })}`, 'a.csv');
        expect(records[0].start).toBe('08:30');
    });
    it('未確定・伝票番号なし・重複は警告', () => {
        const text = [header, row({ 状態: '未確定' }), row({ 実績ID: 'R2', 伝票番号: '' }), row({ 実績ID: 'R2' })].join('\n');
        const { records, issues } = parseWorkRecords(text, 'a.csv');
        expect(records.map((r) => r.id)).toEqual(['R1', 'R2']);
        expect(issues.map((i) => i.level)).toEqual(['warn', 'warn', 'warn']);
    });
    it('取り込み済みのIDとの重複も検知する', () => {
        const { records, issues } = parseWorkRecords(`${header}\n${row()}`, 'b.csv', new Set(['R1']));
        expect(records).toEqual([]);
        expect(issues[0].message).toContain('重複');
    });
});
describe('parseEquipment', () => {
    const eqHeader = EQUIPMENT_COLUMNS.map((c) => c.label).join(',');
    it('機材明細を取り込む', () => {
        const text = `${eqHeader}\nM1,2026-10-01,C001,S01,除草,車両トラック,2,D-1`;
        const { equipment, issues } = parseEquipment(text, 'm.csv');
        expect(issues).toEqual([]);
        expect(equipment[0]).toMatchObject({ item: '車両トラック', quantity: 2, work: '除草', source: 'csv' });
    });
    it('数量が整数でなければエラー', () => {
        const { equipment, issues } = parseEquipment(`${eqHeader}\nM1,2026-10-01,C001,S01,,車両,1.5,`, 'm.csv');
        expect(equipment).toEqual([]);
        expect(issues[0].level).toBe('error');
    });
});
describe('detectKind / parseAnyCsv', () => {
    it('ヘッダーで種類を判別する', () => {
        expect(detectKind(`﻿${header}\n`)).toBe('records');
        expect(detectKind('機材明細ID,勤務日\n')).toBe('equipment');
        expect(detectKind('a,b\n')).toBeNull();
    });
    it('どちらでもないCSVはエラー', () => {
        const r = parseAnyCsv('a,b\n1,2', 'x.csv', { recordIds: new Set(), equipmentIds: new Set() });
        expect(r.kind).toBeNull();
        expect(r.issues[0].level).toBe('error');
    });
});
