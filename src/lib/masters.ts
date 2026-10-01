import type { Client, Masters, Rate, WorkRecord } from '../types'

export function emptyMasters(): Masters {
  return {
    version: 1,
    company: {
      name: '',
      postalCode: '',
      address: '',
      tel: '',
      registrationNo: '',
      bankInfo: '',
      taxRounding: 'floor',
    },
    clients: [],
    rates: [],
  }
}

export function newClient(id: string, name: string): Client {
  return {
    id,
    name,
    honorific: '御中',
    billingMethod: 'ninku',
    ninkuMode: 'perDay',
    standardMinutes: 480,
    closingDay: 0,
    paymentMonthOffset: 1,
    paymentDay: 0,
    invoiceUnit: 'client',
    expenseMode: 'include',
  }
}

export function newRate(clientId: string, siteId: string, shiftType: string): Rate {
  return {
    id: crypto.randomUUID(),
    clientId,
    siteId,
    shiftType,
    unitPrice: 0,
    holidayUnitPrice: 0,
    overtimeHourly: 0,
    nightAddHourly: 0,
  }
}

/** 実績にあってマスタにない元請けを、初期値で作る */
export function missingClients(records: WorkRecord[], masters: Masters): Client[] {
  const known = new Set(masters.clients.map((c) => c.id))
  const added = new Map<string, Client>()
  for (const r of records) {
    if (!known.has(r.clientId) && !added.has(r.clientId)) {
      added.set(r.clientId, newClient(r.clientId, r.clientName))
    }
  }
  return [...added.values()]
}

/** 実績にあって単価が見つからない「元請け × 勤務区分」を、全現場共通の単価として作る */
export function missingRates(records: WorkRecord[], masters: Masters): Rate[] {
  const added = new Map<string, Rate>()
  for (const r of records) {
    const hasRate = masters.rates.some(
      (x) =>
        x.clientId === r.clientId &&
        x.shiftType === r.shiftType &&
        (x.siteId === '' || x.siteId === r.siteId),
    )
    const key = `${r.clientId}\u0000${r.shiftType}`
    if (!hasRate && !added.has(key)) added.set(key, newRate(r.clientId, '', r.shiftType))
  }
  return [...added.values()]
}

/** 読み込んだJSONを検証し、欠けている項目は初期値で補う */
export function parseMasters(json: string): Masters {
  const data = JSON.parse(json) as Partial<Masters>
  if (data.version !== 1 || !Array.isArray(data.clients) || !Array.isArray(data.rates)) {
    throw new Error('SOROBANのマスタファイルではありません')
  }
  const base = emptyMasters()
  return {
    version: 1,
    company: { ...base.company, ...data.company },
    clients: data.clients.map((c) => ({ ...newClient(c.id, c.name), ...c })),
    rates: data.rates.map((r) => ({ ...newRate(r.clientId, r.siteId ?? '', r.shiftType), ...r })),
  }
}
