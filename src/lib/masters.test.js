import { describe, expect, it } from 'vitest';
import { normalizeMasters } from './masters';
describe('normalizeMasters', () => {
    it('旧形式(version 1)の単価を日勤・夜勤の単価にまとめる', () => {
        const m = normalizeMasters({
            version: 1,
            company: { name: 'A社' },
            clients: [{ id: 'C001', name: 'B建設' }],
            rates: [
                { clientId: 'C001', siteId: '', shiftType: '日勤', unitPrice: 18000, overtimeHourly: 2800 },
                { clientId: 'C001', siteId: '', shiftType: '夜勤', unitPrice: 22000, overtimeHourly: 0 },
            ],
        });
        expect(m.version).toBe(2);
        expect(m.company).toMatchObject({ name: 'A社', fax: '', taxRounding: 'floor' });
        expect(m.clients[0]).toMatchObject({ id: 'C001', nightStart: '20:00' });
        expect(m.rates).toMatchObject([{ jobType: '', dayPrice: 18000, nightPrice: 22000, overtimeHourly: 2800 }]);
        expect(m.sites).toEqual([]);
    });
    it('マスタでないものはエラー', () => {
        expect(() => normalizeMasters({ foo: 1 })).toThrow();
        expect(() => normalizeMasters(null)).toThrow();
    });
});
