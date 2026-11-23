import { getLocalStorage, setLocalStorage } from '@/common/localstorage'
import { legacyAppearance, type ResumeAppearance } from './appearance'

export interface ResumeDraft {
  id: string
  name: string
  templateType: string
  content: string
  createdAt: number
  updatedAt: number
  appearance?: ResumeAppearance
  baseTemplate?: string
}

const DRAFTS_KEY = 'resume-drafts'
const API_PATH = '/api/local-drafts'
const writeQueues = new Map<string, Promise<number | undefined>>()

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function getBrowserDrafts(): ResumeDraft[] {
  const stored = getLocalStorage(DRAFTS_KEY)
  return Array.isArray(stored) ? (stored as ResumeDraft[]) : []
}

function saveBrowserDrafts(drafts: ResumeDraft[]) {
  setLocalStorage(DRAFTS_KEY, drafts, null)
}

async function request<T>(path = '', options?: RequestInit): Promise<T | undefined> {
  try {
    const response = await fetch(`${API_PATH}${path}`, options)
    if (!response.ok) return
    return (await response.json()) as T
  } catch {
    return
  }
}

async function saveDraft(draft: ResumeDraft) {
  const saved = await request<ResumeDraft>(`/${draft.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft)
  })
  if (saved) return
  const drafts = getBrowserDrafts().filter(item => item.id !== draft.id)
  drafts.unshift(draft)
  saveBrowserDrafts(drafts)
}

export async function getDrafts(): Promise<ResumeDraft[]> {
  const fileDrafts = await request<ResumeDraft[]>()
  if (fileDrafts) {
    const browserDrafts = getBrowserDrafts()
    const fileIds = new Set(fileDrafts.map(draft => draft.id))
    const pending = browserDrafts.filter(draft => !fileIds.has(draft.id))
    await Promise.all(pending.map(saveDraft))
    if (browserDrafts.length) saveBrowserDrafts([])
    return [...fileDrafts, ...pending].sort((a, b) => b.updatedAt - a.updatedAt)
  }
  return getBrowserDrafts().sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function migrateLegacyDrafts(templateNames: Record<string, string>) {
  const drafts = await getDrafts()
  const existingTypes = new Set(drafts.map(draft => draft.templateType))
  const migrations: Promise<void>[] = []
  Object.keys(templateNames).forEach(templateType => {
    const content = getLocalStorage(`markdown-content-${templateType}`)
    if (content === false || existingTypes.has(templateType)) return
    const updatedAt = getLocalStorage(`markdown-content-updated-at-${templateType}`)
    const timestamp = typeof updatedAt === 'number' ? updatedAt : Date.now()
    const draft: ResumeDraft = {
      id: createId(),
      name: `${templateNames[templateType]}草稿`,
      templateType,
      content: String(content),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    drafts.push(draft)
    migrations.push(saveDraft(draft))
  })
  await Promise.all(migrations)
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDraft(id: string) {
  return (await request<ResumeDraft>(`/${id}`)) || getBrowserDrafts().find(draft => draft.id === id)
}

export async function createDraft(
  templateType: string,
  templateName: string,
  content: string,
  options?: { appearance?: ResumeAppearance; baseTemplate?: string }
) {
  const timestamp = Date.now()
  const draft: ResumeDraft = {
    id: createId(),
    name: `${templateName}草稿`,
    templateType,
    content,
    appearance: { ...options?.appearance },
    baseTemplate: options?.baseTemplate,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  await saveDraft(draft)
  return draft
}

export function updateDraftContent(id: string, content: string) {
  const previous = writeQueues.get(id) || Promise.resolve(undefined)
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      const draft = await getDraft(id)
      if (!draft) return
      draft.content = content
      draft.updatedAt = Date.now()
      await saveDraft(draft)
      return draft.updatedAt
    })
  writeQueues.set(id, current)
  current.finally(() => {
    if (writeQueues.get(id) === current) writeQueues.delete(id)
  })
  return current
}

export async function flushDraftWrites(id: string) {
  await writeQueues.get(id)
}

export function updateDraftAppearance(id: string, appearance: ResumeAppearance) {
  const snapshot = { ...appearance }
  const previous = writeQueues.get(id) || Promise.resolve(undefined)
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      const draft = await getDraft(id)
      if (!draft) return
      draft.appearance = snapshot
      draft.updatedAt = Date.now()
      await saveDraft(draft)
      return draft.updatedAt
    })
  writeQueues.set(id, current)
  current.finally(() => {
    if (writeQueues.get(id) === current) writeQueues.delete(id)
  })
  return current
}

export async function renameDraft(id: string, name: string) {
  const draft = await getDraft(id)
  if (!draft) return
  draft.name = name.trim()
  draft.updatedAt = Date.now()
  await saveDraft(draft)
}

export async function copyDraft(id: string) {
  await flushDraftWrites(id)
  const source = await getDraft(id)
  if (!source) return
  const timestamp = Date.now()
  const copy: ResumeDraft = {
    ...source,
    appearance: { ...(source.appearance ?? legacyAppearance(source.templateType)) },
    id: createId(),
    name: `${source.name} - 副本`,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  await saveDraft(copy)
  return copy
}

export async function deleteDraft(id: string) {
  const deleted = await request(`/${id}`, { method: 'DELETE' })
  if (deleted) return
  saveBrowserDrafts(getBrowserDrafts().filter(draft => draft.id !== id))
}
