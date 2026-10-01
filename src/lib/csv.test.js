import { describe, expect, it } from 'vitest';
import { decodeBytes, parseCsv, toCsv } from './csv';
describe('parseCsv', () => {
    it('BOM・CRLF・クォート内のカンマと改行を扱える', () => {
        const text = '﻿a,b\r\n"x,1","改\n行"\r\n"say ""hi""",\r\n\r\n';
        expect(parseCsv(text)).toEqual([
            ['a', 'b'],
            ['x,1', '改\n行'],
            ['say "hi"', ''],
        ]);
    });
    it('末尾に改行がなくても最後の行を読む', () => {
        expect(parseCsv('a,b\n1,2')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });
    it('toCsv で書いたものを読み戻せる', () => {
        const rows = [['請求書番号', '摘要'], ['202610-C001', '交通費, 駐車場"代"']];
        expect(parseCsv(toCsv(rows))).toEqual(rows);
    });
});
describe('decodeBytes', () => {
    it('UTF-8 を読む', () => {
        expect(decodeBytes(new TextEncoder().encode('実績ID'))).toBe('実績ID');
    });
    it('Shift_JIS を読む', () => {
        // 「実績」の Shift_JIS
        expect(decodeBytes(new Uint8Array([0x8e, 0xc0, 0x90, 0xd1]))).toBe('実績');
    });
});
