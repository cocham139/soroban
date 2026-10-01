const DAY = 24 * 60;
export function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function overlap(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}
/**
 * 勤務時間を日勤帯・夜勤帯に分ける。
 * - 終了が開始以前なら翌日の終了とみなす
 * - 夜勤帯も終了が開始以前なら翌日まで(例: 20:00〜05:00)
 * - 休憩は長いほうの時間帯から引く(例: 19:00〜04:00、休憩60分、夜勤帯20:00〜 → 日勤60分・夜勤420分)
 */
export function splitDayNight(start, end, breakMinutes, nightStart, nightEnd) {
    const s = toMinutes(start);
    let e = toMinutes(end);
    if (e <= s)
        e += DAY;
    const ns = toMinutes(nightStart);
    const ne = toMinutes(nightEnd);
    // 夜勤帯を 0〜2日分のタイムライン上の区間として並べる
    const bands = ns < ne
        ? [[ns, ne], [ns + DAY, ne + DAY]]
        : [[0, ne], [ns, ne + DAY], [ns + DAY, 2 * DAY]];
    let night = bands.reduce((sum, [b1, b2]) => sum + overlap(s, e, b1, b2), 0);
    let day = e - s - night;
    let rest = breakMinutes;
    if (night > day) {
        const cut = Math.min(rest, night);
        night -= cut;
        rest -= cut;
    }
    const cut = Math.min(rest, day);
    day -= cut;
    rest -= cut;
    night -= Math.min(rest, night);
    return { day, night };
}
export function formatHours(minutes) {
    return Math.round((minutes / 60) * 100) / 100;
}
