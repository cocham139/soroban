import { useState } from 'react'
import type { ItemBasis, Masters, QuoteItem, WorkRecord } from '../types'
import { BASIS_LABELS, itemsFor, parseQuotePaste, type PastedItem } from '../lib/items'
import { newItemRule, newQuoteItem } from '../lib/masters'
import { yen } from '../lib/format'

interface Props {
  masters: Masters
  setMasters: (m: Masters) => void
  records: WorkRecord[]
}

const toInt = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

const basisSelect = (value: ItemBasis, onChange: (b: ItemBasis) => void) => (
  <select value={value} onChange={(e) => onChange(e.target.value as ItemBasis)}>
    {(Object.keys(BASIS_LABELS) as ItemBasis[]).map((b) => (
      <option key={b} value={b}>{BASIS_LABELS[b]}</option>
    ))}
  </select>
)

/** マスタ: 見積書(品目と単価)と、実績との対応づけ */
export default function QuoteItemsSection({ masters, setMasters, records }: Props) {
  const [clientId, setClientId] = useState(masters.clients[0]?.id ?? '')
  const [siteId, setSiteId] = useState('')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PastedItem[] | null>(null)

  const clientName = (id: string) => masters.clients.find((c) => c.id === id)?.name ?? id
  const siteName = (cid: string, sid: string) =>
    masters.sites.find((s) => s.clientId === cid && s.siteId === sid)?.coverName.split('\n')[0] ??
    records.find((r) => r.clientId === cid && r.siteId === sid)?.siteName ??
    ''
  const setItems = (quoteItems: QuoteItem[]) => setMasters({ ...masters, quoteItems })
  const updateItem = (id: string, patch: Partial<QuoteItem>) =>
    setItems(masters.quoteItems.map((q) => (q.id === id ? { ...q, ...patch } : q)))


  function addPasted() {
    if (!preview) return
    setItems([...masters.quoteItems, ...preview.map((p) => newQuoteItem(clientId, siteId.trim(), p))])
    setPreview(null)
    setText('')
  }

  const pending = masters.quoteItems.filter((q) => q.needsQuote)

  return (
    <>
      <h3>見積書(品目と単価)</h3>
      <p className="hint">
        見積書がある元請け・現場は、人の単価ではなく、見積書の品目で請求します。
        Excelの見積書の「品目・数量・単位・単価」の範囲をコピーして、下に貼り付けてください。
        SHIRUBEの実績との対応づけは、請求書の画面の「品目の割り当て待ち」で一度選べば、次からは自動で割り当てます。
      </p>
      <div className="paste-box">
        <div className="toolbar">
          <label>
            元請け{' '}
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {masters.clients.map((c) => <option key={c.id} value={c.id}>{c.id} {c.name}</option>)}
            </select>
          </label>
          <label>
            現場ID <input className="s" value={siteId} placeholder="空欄=全現場" onChange={(e) => setSiteId(e.target.value)} />
          </label>
        </div>
        <textarea
          rows={5}
          placeholder="ここにExcelの見積書からコピーした範囲を貼り付け(品目名・数量・単位・単価・金額の行)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="toolbar">
          <button className="primary" disabled={!text.trim() || !clientId} onClick={() => setPreview(parseQuotePaste(text))}>
            読み取る
          </button>
          {masters.clients.length === 0 && <span className="warn-text">先に「元請け」を登録してください。</span>}
        </div>
        {preview && (
          <div className="paste-preview">
            {preview.length === 0 ? (
              <p className="warn-text">品目を読み取れませんでした。品目名と単価が入った行をコピーしているか確認してください。</p>
            ) : (
              <>
                <p className="hint">{preview.length} 件を読み取りました。数え方を確かめてから追加してください。</p>
                <div className="scroll">
                  <table className="grid edit">
                    <thead><tr><th>品目</th><th>数量</th><th>単位</th><th>単価</th><th>数え方</th></tr></thead>
                    <tbody>
                      {preview.map((p, i) => (
                        <tr key={i}>
                          <td>{p.name}</td>
                          <td className="num">{p.quantity || ''}</td>
                          <td>{p.unit}</td>
                          <td className="num">{yen(p.unitPrice)}</td>
                          <td>{basisSelect(p.basis, (b) => setPreview(preview.map((x, j) => (i === j ? { ...x, basis: b } : x))))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="toolbar">
                  <button className="primary" onClick={addPasted}>
                    {clientName(clientId)}{siteId.trim() ? ` ${siteId.trim()}` : '(全現場)'}の見積書として追加
                  </button>
                  <button onClick={() => setPreview(null)}>やめる</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <p className="callout">
          見積書にない品目が {pending.length} 件あります(請求の途中で足したもの)。追加の見積書を出したら「見積済みにする」を押してください:
          {' '}{pending.map((q) => q.name).join('、')}
        </p>
      )}

      {masters.quoteItems.length > 0 && (
        <div className="scroll">
          <table className="grid edit">
            <thead>
              <tr><th>元請け</th><th>現場ID</th><th>品目</th><th>単位</th><th>単価</th><th>数え方</th><th>見積数量</th><th>状態</th><th></th></tr>
            </thead>
            <tbody>
              {masters.quoteItems.map((q) => (
                <tr key={q.id}>
                  <td className="nowrap">{clientName(q.clientId)}</td>
                  <td>
                    <input className="s" value={q.siteId} placeholder="(全現場)" onChange={(e) => updateItem(q.id, { siteId: e.target.value })} />
                    <span className="sub">{q.siteId && siteName(q.clientId, q.siteId)}</span>
                  </td>
                  <td><input className="item-name" value={q.name} onChange={(e) => updateItem(q.id, { name: e.target.value })} /></td>
                  <td><input className="xs" value={q.unit} onChange={(e) => updateItem(q.id, { unit: e.target.value })} /></td>
                  <td><input className="n" type="number" min={0} value={q.unitPrice} onChange={(e) => updateItem(q.id, { unitPrice: toInt(e.target.value) })} /></td>
                  <td>{basisSelect(q.basis, (b) => updateItem(q.id, { basis: b }))}</td>
                  <td><input className="n" type="number" min={0} value={q.quantity} onChange={(e) => updateItem(q.id, { quantity: Number(e.target.value) || 0 })} /></td>
                  <td className="nowrap">
                    {q.needsQuote ? (
                      <>
                        <span className="warn-text">追加見積が必要</span>{' '}
                        <button onClick={() => updateItem(q.id, { needsQuote: false })}>見積済みにする</button>
                      </>
                    ) : (
                      '見積済み'
                    )}
                  </td>
                  <td>
                    <button
                      className="danger"
                      onClick={() =>
                        confirm(`${q.name} を削除します。よろしいですか?`) &&
                        setMasters({
                          ...masters,
                          quoteItems: masters.quoteItems.filter((x) => x.id !== q.id),
                          itemRules: masters.itemRules.filter((r) => r.dayItemId !== q.id && r.nightItemId !== q.id),
                        })
                      }
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {masters.itemRules.length > 0 && (
        <>
          <h3>実績と品目の対応づけ</h3>
          <p className="hint">
            SHIRUBEの実績(元請け × 現場 × 職種 × 作業名)を、どの品目で請求するかの決まりです。空欄は「どれでも」。
            細かく指定した決まりが優先されます。請求書の画面で割り当てると、ここに自動で増えます。
          </p>
          <div className="scroll">
            <table className="grid edit">
              <thead>
                <tr><th>元請け</th><th>現場ID</th><th>職種</th><th>作業名</th><th>昼の品目</th><th>夜の品目</th><th></th></tr>
              </thead>
              <tbody>
                {masters.itemRules.map((r) => {
                  const choices = itemsFor(masters.quoteItems, r.clientId, r.siteId)
                  const set = (patch: Partial<typeof r>) =>
                    setMasters({ ...masters, itemRules: masters.itemRules.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) })
                  return (
                    <tr key={r.id}>
                      <td className="nowrap">{clientName(r.clientId)}</td>
                      <td><input className="s" value={r.siteId} placeholder="(どれでも)" onChange={(e) => set({ siteId: e.target.value })} /></td>
                      <td><input className="s" value={r.jobType} placeholder="(どれでも)" onChange={(e) => set({ jobType: e.target.value })} /></td>
                      <td><input className="s" value={r.work} placeholder="(どれでも)" onChange={(e) => set({ work: e.target.value })} /></td>
                      <td>
                        <select className="item-select" value={r.dayItemId} onChange={(e) => set({ dayItemId: e.target.value })}>
                          {!r.dayItemId && <option value="">(選択)</option>}
                          {choices.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="item-select" value={r.nightItemId} onChange={(e) => set({ nightItemId: e.target.value })}>
                          <option value="">(昼と同じ)</option>
                          {choices.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <button
                          className="danger"
                          onClick={() => setMasters({ ...masters, itemRules: masters.itemRules.filter((x) => x.id !== r.id) })}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={() => setMasters({ ...masters, itemRules: [...masters.itemRules, newItemRule({ clientId: masters.clients[0]?.id ?? '' })] })}>
            対応づけを追加
          </button>
        </>
      )}
    </>
  )
}
