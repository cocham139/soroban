import type { Client, EquipmentRate, EquipmentRecord, Masters, Rate, Site, WorkRecord } from '../types'

export function emptyMasters(): Masters {
  return {
    version: 2,
    company: {
      name: '',
      postalCode: '',
      address: '',
      tel: '',
      fax: '',
      registrationNo: '',
      bankInfo: '',
      taxRounding: 'floor',
    },
    clients: [],
    sites: [],
    rates: [],
    equipmentRates: [],
  }
}

export function newClient(id: string, name: string): Client {
  return {
    id,
    name,
    honorific: '御中',
    billingMethod: 'hourly',
    ninkuMode: 'perDay',
    standardMinutes: 480,
    dayNightRule: 'band',
    nightStart: '20:00',
    nightEnd: '06:00',
    closingDay: 0,
    paymentMonthOffset: 1,
    paymentDay: 0,
    invoiceUnit: 'client',
    expenseMode: 'include',
  }
}

export function newSite(clientId: string, siteId: string, coverName = ''): Site {
  return { clientId, siteId, coverName, spec: '', dayNightRule: '' }
}

export function newRate(clientId: string, siteId: string, jobType: string): Rate {
  return { id: crypto.randomUUID(), clientId, siteId, jobType, dayPrice: 0, nightPrice: 0, overtimeHourly: 0 }
}

export function newEquipmentRate(clientId: string, siteId: string, item: string): EquipmentRate {
  return { id: crypto.randomUUID(), clientId, siteId, item, unitPrice: 0 }
}

/** 実績にあってマスタにない元請けを、初期値で作る */
export function missingClients(records: WorkRecord[], masters: Masters): Client[] {
  const known = new Set(masters.clients.map((c) => c.id))
  const added = new Map<string, Client>()
  for (const r of records) {
    if (!known.has(r.clientId) && !added.has(r.clientId)) added.set(r.clientId, newClient(r.clientId, r.clientName))
  }
  return [...added.values()]
}

/** 実績・機材にあってマスタにない現場を、CSVの現場名で作る */
export function missingSites(records: WorkRecord[], equipment: EquipmentRecord[], masters: Masters): Site[] {
  const key = (c: string, s: string) => `${c}\u0000${s}`
  const known = new Set(masters.sites.map((s) => key(s.clientId, s.siteId)))
  const added = new Map<string, Site>()
  for (const r of [...records, ...equipment]) {
    const k = key(r.clientId, r.siteId)
    if (!known.has(k) && !added.has(k)) {
      added.set(k, newSite(r.clientId, r.siteId, 'siteName' in r ? r.siteName : ''))
    }
  }
  return [...added.values()]
}

/** 実績にあって単価が見つからない「元請け × 職種」を、全現場共通の単価として作る */
export function missingRates(records: WorkRecord[], masters: Masters): Rate[] {
  const added = new Map<string, Rate>()
  for (const r of records) {
    const has = masters.rates.some(
      (x) => x.clientId === r.clientId && x.jobType === r.jobType && (x.siteId === '' || x.siteId === r.siteId),
    )
    const k = `${r.clientId}\u0000${r.jobType}`
    if (!has && !added.has(k)) added.set(k, newRate(r.clientId, '', r.jobType))
  }
  return [...added.values()]
}

/** 機材にあって単価が見つからない「元請け × 現場 × 品目」を作る(機材は現場ごとに単価が違うことが多い) */
export function missingEquipmentRates(equipment: EquipmentRecord[], masters: Masters): EquipmentRate[] {
  const added = new Map<string, EquipmentRate>()
  for (const e of equipment) {
    const has = masters.equipmentRates.some(
      (x) => x.clientId === e.clientId && x.item === e.item && (x.siteId === '' || x.siteId === e.siteId),
    )
    const k = `${e.clientId}\u0000${e.siteId}\u0000${e.item}`
    if (!has && !added.has(k)) added.set(k, newEquipmentRate(e.clientId, e.siteId, e.item))
  }
  return [...added.values()]
}

/**
 * 読み込んだデータ(JSONファイル・ブラウザ保存)を検証し、欠けている項目は初期値で補う。
 * 旧形式(version 1)のマスタは、勤務区分ごとの単価を日勤・夜勤の単価にまとめて読み込む。
 */
export function normalizeMasters(data: unknown): Masters {
  const d = data as Omit<Partial<Masters>, 'version'> & { version?: number }
  if (!d || (d.version !== 1 && d.version !== 2) || !Array.isArray(d.clients) || !Array.isArray(d.rates)) {
    throw new Error('SOROBANのマスタファイルではありません')
  }
  const base = emptyMasters()
  let rates: Rate[]
  if (d.version === 1) {
    const merged = new Map<string, Rate>()
    for (const old of d.rates as unknown as { clientId: string; siteId: string; shiftType: string; unitPrice: number; overtimeHourly: number }[]) {
      const k = `${old.clientId}\u0000${old.siteId}`
      const r = merged.get(k) ?? newRate(old.clientId, old.siteId ?? '', '')
      if (old.shiftType?.includes('夜')) r.nightPrice = old.unitPrice
      else r.dayPrice = old.unitPrice
      r.overtimeHourly ||= old.overtimeHourly ?? 0
      merged.set(k, r)
    }
    rates = [...merged.values()]
  } else {
    rates = d.rates.map((r) => ({ ...newRate(r.clientId, r.siteId ?? '', r.jobType ?? ''), ...r }))
  }
  return {
    version: 2,
    company: { ...base.company, ...d.company },
    clients: d.clients.map((c) => ({ ...newClient(c.id, c.name), ...c })),
    sites: (Array.isArray(d.sites) ? d.sites : []).map((s) => ({ ...newSite(s.clientId, s.siteId), ...s })),
    rates,
    equipmentRates: (Array.isArray(d.equipmentRates) ? d.equipmentRates : []).map((e) => ({
      ...newEquipmentRate(e.clientId, e.siteId ?? '', e.item),
      ...e,
    })),
  }
}

export function parseMasters(json: string): Masters {
  return normalizeMasters(JSON.parse(json))
}
