import { ref } from 'vue'
import {
  readTemplateLibrary,
  writeTemplate,
  deleteTemplate,
  type SavedTemplate
} from '@/common/templateLibrary'
import type { ResumeAppearance } from '@/common/appearance'

const initialCVState: Map<string, string[]> = new Map()

// 创作模板的默认配置
initialCVState.set('create', ['#333', '#333', '', '25'])

type Module = {
  default: SubModule
}

type SubModule = {
  type: string
  id: number
  name: string
  font?: string
  lineHeight?: number
  content: string
  primaryColor: string
  primaryBackground: string
  img: string
  hot?: number | string
  baseTemplate?: string
  appearance?: ResumeAppearance
  updatedAt?: number
}
export type TemplateType = SubModule

export const templates = ref<SubModule[]>([])

const moduleEntries = Object.entries(import.meta.glob('./modules/*/index.ts', { eager: true }))

for (const [path, curModule] of moduleEntries) {
  const content = (curModule as Module).default
  content.id = Math.ceil(Math.random() * 1000000000)
  content.type = path.split('/')[2]
  templates.value.push(content)
  initialCVState.set(content.type, [
    content.primaryColor,
    content.primaryBackground,
    content.font || '',
    String(content.lineHeight || 25)
  ])
}

const match = (module: SubModule) => +(module.type.match(/^\d+/) as RegExpMatchArray)[0]
templates.value.sort((a, b) => match(b) - match(a))
const bundledTemplates = [...templates.value]
export const templateLabels = ref<Record<string, string>>(
  Object.fromEntries(bundledTemplates.map(item => [item.type, item.name]))
)
let loading: Promise<void> | undefined
let libraryRevision = 0

function mergeTemplate(saved: SavedTemplate): SubModule {
  const bundled = bundledTemplates.find(item => item.type === saved.type)
  const base = bundledTemplates.find(item => item.type === saved.baseTemplate)
  return {
    id: bundled?.id || saved.updatedAt,
    primaryColor: base?.primaryColor || '#333',
    primaryBackground: base?.primaryBackground || '#333',
    font: base?.font || 'Noto Serif SC',
    img: bundled?.img || '',
    ...bundled,
    ...saved
  }
}

export function loadTemplateLibrary(): Promise<void> {
  if (loading) return loading
  const revision = libraryRevision
  loading = readTemplateLibrary()
    .then(saved => {
      if (revision !== libraryRevision) return
      const records = new Map(bundledTemplates.map(item => [item.type, item]))
      saved.forEach(original => {
        const item = {
          ...original,
          type: resolveTemplateType(original.type),
          baseTemplate: resolveTemplateType(original.baseTemplate)
        }
        templateLabels.value[item.type] = item.name
        if (item.deleted) records.delete(item.type)
        else records.set(item.type, mergeTemplate(item))
      })
      templates.value = Array.from(records.values()).sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      )
    })
    .finally(() => {
      loading = undefined
    })
  return loading
}

export async function saveLibraryTemplate(template: SavedTemplate) {
  await writeTemplate(template)
  libraryRevision++
  const saved = mergeTemplate(template)
  templateLabels.value[template.type] = template.name
  const index = templates.value.findIndex(item => item.type === template.type)
  if (index < 0) templates.value.unshift(saved)
  else templates.value[index] = saved
  return saved
}

export async function removeLibraryTemplate(type: string) {
  const template = templates.value.find(item => item.type === type)
  if (!template) return
  await deleteTemplate(type, template.baseTemplate || type, template.name)
  libraryRevision++
  templates.value = templates.value.filter(item => item.type !== type)
}

export async function addLibraryTemplate(name: string) {
  return await saveLibraryTemplate({
    type: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    content: '',
    baseTemplate: 'create',
    appearance: {},
    updatedAt: Date.now()
  })
}

// Keep old numeric template URLs usable after public sample names change.
export function resolveTemplateType(type: string) {
  if (templates.value.some(item => item.type === type) || type === 'create') return type
  const prefix = type.match(/^\d+/)?.[0]
  return (
    (prefix && bundledTemplates.find(item => item.type.match(/^\d+/)?.[0] === prefix)?.type) || type
  )
}

export function getPrimaryBGColor(type: string) {
  return (initialCVState.get(resolveTemplateType(type)) ||
    (initialCVState.get('create') as string[]))[1]
}

export function getPrimaryColor(type: string) {
  return (initialCVState.get(resolveTemplateType(type)) ||
    (initialCVState.get('create') as string[]))[0]
}

export function getFontFamily(type: string) {
  return (initialCVState.get(resolveTemplateType(type)) ||
    (initialCVState.get('create') as string[]))[2]
}
