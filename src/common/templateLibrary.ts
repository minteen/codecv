import { getLocalStorage, setLocalStorage } from './localstorage'
import type { ResumeAppearance } from './appearance'

export interface SavedTemplate {
  type: string
  name: string
  content: string
  baseTemplate: string
  appearance: ResumeAppearance
  updatedAt: number
  deleted?: boolean
}
const KEY = 'resume-template-library'
const API = '/api/local-templates'
const queues = new Map<string, Promise<void>>()

export function deleteTemplate(type: string, baseTemplate: string, name = '已删除模板') {
  // Keep a tombstone so bundled templates and stale offline copies cannot
  // reappear after reload. Existing resumes own their content and appearance.
  return writeTemplate({
    type,
    baseTemplate,
    name,
    content: '',
    appearance: {},
    updatedAt: Date.now(),
    deleted: true
  })
}

function browserTemplates(): SavedTemplate[] {
  const value = getLocalStorage(KEY)
  return Array.isArray(value) ? (value as SavedTemplate[]) : []
}

export async function readTemplateLibrary(): Promise<SavedTemplate[]> {
  try {
    const response = await fetch(API, { signal: AbortSignal.timeout(5000) })
    if (response.ok) {
      const saved = await response.json()
      if (Array.isArray(saved)) {
        const files = new Map<string, SavedTemplate>(
          saved.map((item: SavedTemplate) => [item.type, item])
        )
        const pending = browserTemplates().filter(
          item => item.updatedAt > (files.get(item.type)?.updatedAt || 0)
        )
        await Promise.all(pending.map(writeTemplate))
        pending.forEach(item => files.set(item.type, item))
        // Remember remote deletions locally as well, including when an older
        // offline edit of the same template is still present in this browser.
        const deletions = Array.from(files.values()).filter(item => item.deleted)
        const cache = browserTemplates().filter(
          item =>
            !deletions.some(
              deleted => deleted.type === item.type && deleted.updatedAt >= item.updatedAt
            )
        )
        setLocalStorage(KEY, [...deletions, ...cache], null)
        return Array.from(files.values())
      }
    }
  } catch {
    /* Static hosting uses local browser storage. */
  }
  return browserTemplates()
}

export function writeTemplate(template: SavedTemplate): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(template)) as SavedTemplate
  const previous = queues.get(template.type) || Promise.resolve()
  const pending = previous
    .catch(() => undefined)
    .then(async () => {
      let response: Response | undefined
      try {
        response = await fetch(`${API}/${encodeURIComponent(snapshot.type)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
          signal: AbortSignal.timeout(5000)
        })
      } catch {
        /* Fall back only when the local API is unavailable. */
      }
      if (response && response.status >= 500) throw new Error('模板保存失败，请重试')
      if (response?.ok) {
        const remaining = browserTemplates().filter(item => item.type !== snapshot.type)
        if (snapshot.deleted) remaining.unshift(snapshot)
        setLocalStorage(KEY, remaining, null)
        return
      }
      if (response && ![404, 405].includes(response.status)) throw new Error('模板保存失败，请重试')
      setLocalStorage(
        KEY,
        [snapshot, ...browserTemplates().filter(item => item.type !== snapshot.type)],
        null
      )
    })
  queues.set(template.type, pending)
  const cleanup = () => {
    if (queues.get(template.type) === pending) queues.delete(template.type)
  }
  pending.then(cleanup, cleanup)
  return pending
}
