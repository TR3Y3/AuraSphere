// Thin fetch wrapper. Always sends the session cookie (credentials: include)
// so the httpOnly auth cookie rides along with every request.
//
// Data shapes are derived from the generated OpenAPI types (src/types/api.ts)
// via `npm run gen:api` — never hand-written, so they can't drift from the API.
import type { components } from '../types/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type QueryValue = string | number | boolean | null | undefined

function toQuery(params?: Record<string, QueryValue>): string {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, params?: Record<string, QueryValue>) =>
    request<T>(`${path}${toQuery(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: (path: string) => request<void>(path, { method: 'DELETE' }),
}

type Schemas = components['schemas']

export type Organization = Schemas['OrganizationOut']
export type User = Schemas['UserOut']
export type Me = Schemas['MeOut']
export type Company = Schemas['CompanyOut']
export type CompanyCreate = Schemas['CompanyCreate']
export type CompanyUpdate = Schemas['CompanyUpdate']
export type Contact = Schemas['ContactOut']
export type ContactCreate = Schemas['ContactCreate']
export type ContactUpdate = Schemas['ContactUpdate']
export type CompanyPage = Schemas['Page_CompanyOut_']
export type ContactPage = Schemas['Page_ContactOut_']
export type Carrier = Schemas['CarrierOut']
export type CarrierCreate = Schemas['CarrierCreate']
export type CarrierUpdate = Schemas['CarrierUpdate']
export type CarrierPage = Schemas['Page_CarrierOut_']
export type Load = Schemas['LoadOut']
export type LoadCreate = Schemas['LoadCreate']
export type LoadUpdate = Schemas['LoadUpdate']
export type LoadPage = Schemas['Page_LoadOut_']
export type Pin = Schemas['PinOut']
export type PinCreate = Schemas['PinCreate']
export type LoadOption = Schemas['OptionOut']
export type OptionCreate = Schemas['OptionCreate']
export type OptionUpdate = Schemas['OptionUpdate']
export type Prospect = Schemas['ProspectOut']
export type ProspectCreate = Schemas['ProspectCreate']
export type ProspectPage = Schemas['Page_ProspectOut_']
export type Pipeline = Schemas['PipelineOut']
export type Stage = Schemas['StageOut']
export type Deal = Schemas['DealOut']
export type DealCreate = Schemas['DealCreate']
export type DealUpdate = Schemas['DealUpdate']
export type DealPage = Schemas['Page_DealOut_']
