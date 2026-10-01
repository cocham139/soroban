import { useEffect, useState } from 'react'

/**
 * ブラウザに前回の内容を覚えておくための state。
 * 正本はJSON/CSVファイルなので、保存に失敗しても(プライベートモード等)動作は続ける。
 */
export function useStoredState<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      // 読めなければ初期値
    }
    return initial()
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 保存できなくても画面上の作業は続けられる
    }
  }, [key, value])

  return [value, setValue] as const
}
