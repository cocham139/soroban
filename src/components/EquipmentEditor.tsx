import { useMemo, useState } from 'react'
import type { EquipmentRecord, Masters, WorkRecord } from '../types'
import { monthDay } from '../lib/format'

interface Props {
  records: WorkRecord[]
  equipment: EquipmentRecord[]
  setEquipment: (e: EquipmentRecord[]) => void
  masters: Masters
}

const newId = () => `manual-${crypto.randomUUID()}`

/**
 * 機材・車両の台数を確認・手入力する。
 * SHIRUBEの機材明細CSVがない場合や、CSVの台数を直したい場合に使う。
 */
export default function EquipmentEditor({ records, equipment, setEquipment, masters }: Props) {
  const months = useMemo(
    () => [...new Set([...records, ...equipment].map((x) => x.date.slice(0, 7)))].sort().reverse(),
    [records, equipment],
  )
  const [month, setMonth] = useState('')
  const shownMonth = month || months[0] || ''

  const [form, setForm] = useState({ date: '', clientId: '', siteId: '', work: '', item: '', quantity: 1 })
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch })

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of masters.clients) m.set(c.id, c.name)
    for (const r of records) if (!m.has(r.clientId)) m.set(r.clientId, r.clientName)
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [masters.clients, records])

  const siteNameOf = (clientId: string, siteId: string) =>
    masters.sites.find((s) => s.clientId === clientId && s.siteId === siteId)?.coverName.replace(/\s*\n\s*/g, ' ') ||
    records.find((r) => r.clientId === clientId && r.siteId === siteId)?.siteName ||
    siteId

  const sites = useMemo(() => {
    const ids = new Set<string>()
    for (const r of records) if (r.clientId === form.clientId) ids.add(r.siteId)
    for (const s of masters.sites) if (s.clientId === form.clientId) ids.add(s.siteId)
    return [...ids].sort()
  }, [records, masters.sites, form.clientId])

  const works = [
    ...new Set(
      records
        .filter((r) => r.clientId === form.clientId && r.siteId === form.siteId && (!form.date || r.date === form.date))
        .map((r) => r.work),
    ),
  ]
  const items = [
    ...new Set([
      ...masters.equipmentRates.filter((r) => r.clientId === form.clientId).map((r) => r.item),
      ...equipment.filter((e) => e.clientId === form.clientId).map((e) => e.item),
    ]),
  ].filter(Boolean)

  const ready = form.clientId && form.siteId && form.item && form.quantity > 0
  const make = (date: string, work: string): EquipmentRecord => ({
    id: newId(),
    date,
    clientId: form.clientId,
    siteId: form.siteId,
    work,
    item: form.item,
    quantity: form.quantity,
    slipNo: '',
    source: 'manual',
  })
  const exists = (date: string, work: string) =>
    equipment.some(
      (e) => e.clientId === form.clientId && e.siteId === form.siteId && e.item === form.item && e.date === date && e.work === work,
    )

  function addOne() {
    if (!ready || !form.date) return
    setEquipment([...equipment, make(form.date, form.work)])
  }

  /** この現場に実績がある日(工事名を指定したらその工事名の日)すべてに追加する */
  function addForWorkedDays() {
    if (!ready) return
    const dates = [
      ...new Set(
        records
          .filter(
            (r) =>
              r.clientId === form.clientId &&
              r.siteId === form.siteId &&
              r.date.startsWith(shownMonth) &&
              (!form.work || r.work === form.work),
          )
          .map((r) => r.date),
      ),
    ].sort()
    const toAdd = dates.filter((d) => !exists(d, form.work)).map((d) => make(d, form.work))
    if (toAdd.length === 0) {
      alert('追加できる日がありません(実績がないか、すでに登録済みです)')
      return
    }
    if (confirm(`${shownMonth} の実績がある ${toAdd.length} 日分に「${form.item} ${form.quantity}台」を追加します。よろしいですか?`)) {
      setEquipment([...equipment, ...toAdd])
    }
  }

  const shown = equipment
    .filter((e) => e.date.startsWith(shownMonth) && (!form.clientId || e.clientId === form.clientId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.siteId.localeCompare(b.siteId) || a.item.localeCompare(b.item, 'ja'))

  const update = (id: string, patch: Partial<EquipmentRecord>) =>
    setEquipment(equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  return (
    <div className="equipment-editor">
      <h3>機材・車両</h3>
      <p className="hint">
        SHIRUBEの機材明細CSVを取り込むか、ここで手入力します。工事名を空にすると、その日の内訳書の最初の行に載ります。
      </p>

      <div className="equipment-form">
        <label>勤務日<input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <label>
          元請け
          <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value, siteId: '', work: '' })}>
            <option value="">(選択)</option>
            {clients.map(([id, name]) => <option key={id} value={id}>{id} {name}</option>)}
          </select>
        </label>
        <label>
          現場
          <select value={form.siteId} onChange={(e) => set({ siteId: e.target.value, work: '' })}>
            <option value="">(選択)</option>
            {sites.map((id) => <option key={id} value={id}>{id} {siteNameOf(form.clientId, id)}</option>)}
          </select>
        </label>
        <label>
          工事名(任意)
          <input list="equipment-works" value={form.work} onChange={(e) => set({ work: e.target.value })} />
          <datalist id="equipment-works">{works.map((w) => <option key={w} value={w} />)}</datalist>
        </label>
        <label>
          品目
          <input list="equipment-items" value={form.item} placeholder="車両トラック" onChange={(e) => set({ item: e.target.value })} />
          <datalist id="equipment-items">{items.map((i) => <option key={i} value={i} />)}</datalist>
        </label>
        <label>
          数量
          <input className="n" type="number" min={1} value={form.quantity} onChange={(e) => set({ quantity: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
        </label>
        <div className="buttons">
          <button className="primary" disabled={!ready || !form.date} onClick={addOne}>この日に追加</button>
          <button disabled={!ready || !shownMonth} onClick={addForWorkedDays}>{shownMonth || '—'} の実績がある日すべてに追加</button>
        </div>
      </div>

      <div className="toolbar">
        <label>
          表示する月
          <select value={shownMonth} onChange={(e) => setMonth(e.target.value)}>
            {months.length === 0 && <option value="">(データなし)</option>}
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <span className="hint">
          {shown.length} 件{form.clientId && `(${form.clientId} のみ表示中。元請けの選択を外すと全件)`}
        </span>
      </div>
      {shown.length > 0 && (
        <div className="scroll">
          <table className="grid edit">
            <thead>
              <tr><th>日付</th><th>元請け</th><th>現場</th><th>工事名</th><th>品目</th><th>数量</th><th>入力元</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{monthDay(e.date)}</td>
                  <td>{e.clientId}</td>
                  <td>{siteNameOf(e.clientId, e.siteId)}</td>
                  <td>
                    <input value={e.work} placeholder="(その日の最初の行)" onChange={(ev) => update(e.id, { work: ev.target.value })} />
                  </td>
                  <td>{e.item}</td>
                  <td>
                    <input className="n" type="number" min={0} value={e.quantity}
                      onChange={(ev) => update(e.id, { quantity: Math.max(0, Math.trunc(Number(ev.target.value) || 0)) })} />
                  </td>
                  <td>{e.source === 'manual' ? '手入力' : 'CSV'}</td>
                  <td>
                    <button className="danger" onClick={() => setEquipment(equipment.filter((x) => x.id !== e.id))}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
