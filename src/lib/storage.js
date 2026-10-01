import { useEffect, useState } from 'react';
/**
 * ブラウザに前回の内容を覚えておくための state。
 * 正本はJSON/CSVファイルなので、保存に失敗しても(プライベートモード等)動作は続ける。
 * normalize を渡すと、読み込んだ値を検証・補正する(失敗したら初期値)。
 */
export function useStoredState(key, initial, normalize) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                return normalize ? normalize(parsed) : parsed;
            }
        }
        catch {
            // 読めなければ初期値
        }
        return initial();
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch {
            // 保存できなくても画面上の作業は続けられる
        }
    }, [key, value]);
    return [value, setValue];
}
