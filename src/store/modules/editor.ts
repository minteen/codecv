import { defineStore } from 'pinia'
import { nextTick } from 'vue'

import pinia from '@/store'
import { getLocalStorage, setLocalStorage } from '@/common/localstorage'
import { showMessageVN } from '@/common/message'
import {
  templates,
  loadTemplateLibrary,
  saveLibraryTemplate,
  getPrimaryColor,
  getPrimaryBGColor,
  getFontFamily,
  resolveTemplateType
} from '@/templates/config'
import { ensureEmptyPreWhiteSpace } from '@/views/editor/components/tabbar/hook'
import {
  getDraft,
  updateDraftContent,
  updateDraftAppearance,
  flushDraftWrites
} from '@/common/drafts'
import { appearanceScope, legacyAppearance, type ResumeAppearance } from '@/common/appearance'

const MARKDOWN_CONTENT = 'markdown-content'
const MARKDOWN_CONTENT_UPDATED_AT = 'markdown-content-updated-at'
const WRITABLE = 'writable'

export const getCurrentTypeContent = (type: string): string => {
  for (const template of templates.value) {
    if (type === template.type) {
      return template.content
    }
  }
  return ''
}

const useEditorStore = defineStore('editorStore', {
  state: () => ({
    MDContent: '',
    nativeContent: '',
    nativeStyle: '',
    writable: Boolean(getLocalStorage(WRITABLE)) || false,
    draftSavedAt: null as number | null,
    activeDraftId: null as string | null,
    activeDraftName: '',
    activeTemplateId: null as string | null,
    styleTemplate: 'create',
    templateDirty: false,
    templateSaving: false,
    draftAppearance: {} as ResumeAppearance,
    appearanceScope: '',
    initializingDraft: true,
    draftSession: 0
  }),
  actions: {
    closeDraft() {
      this.draftSession++
      this.initializingDraft = true
      this.activeDraftId = null
      this.activeDraftName = ''
      this.activeTemplateId = null
      this.templateDirty = false
      this.templateSaving = false
      this.draftSavedAt = null
      this.draftAppearance = {}
      this.appearanceScope = ''
    },
    // Only the latest load may bind the shared store to a draft.
    async initMDContent(resumeType: string, draftId?: string) {
      this.closeDraft()
      const session = this.draftSession
      this.styleTemplate = resumeType
      if (draftId) {
        await flushDraftWrites(draftId)
        const draft = await getDraft(draftId)
        if (session !== this.draftSession) return
        if (!draft || draft.id !== draftId) throw new Error('Draft not found')
        this.activeDraftId = draftId
        this.activeDraftName = draft.name
        this.styleTemplate = resolveTemplateType(draft.baseTemplate || resumeType)
        this.MDContent = draft.content
        this.draftSavedAt = draft.updatedAt
        this.draftAppearance = { ...(draft.appearance ?? legacyAppearance(resumeType)) }
        if (draft.appearance === undefined) {
          await updateDraftAppearance(draft.id, this.draftAppearance)
          if (session !== this.draftSession) return
        }
      } else {
        const cachedContent = getLocalStorage(`${MARKDOWN_CONTENT}-${resumeType}`)
        const cachedUpdatedAt = getLocalStorage(`${MARKDOWN_CONTENT_UPDATED_AT}-${resumeType}`)
        this.MDContent =
          cachedContent !== false ? String(cachedContent) : getCurrentTypeContent(resumeType)
        this.draftSavedAt = typeof cachedUpdatedAt === 'number' ? cachedUpdatedAt : null
        this.draftAppearance = legacyAppearance(resumeType)
      }
      this.appearanceScope = appearanceScope(this.activeDraftId, resumeType)
      this.initializingDraft = false
    },
    async initTemplate(type: string) {
      this.closeDraft()
      const session = this.draftSession
      await loadTemplateLibrary()
      if (session !== this.draftSession) return
      const template = templates.value.find(item => item.type === type)
      if (!template) throw new Error('Template not found')
      this.activeTemplateId = type
      this.activeDraftName = template.name
      this.styleTemplate = template.baseTemplate || type
      this.MDContent = template.content
      this.draftAppearance = {
        'custom-markdown-primary-color': getPrimaryColor(type),
        custom_markdown_primary_bg_color: getPrimaryBGColor(type),
        'markdown-font': getFontFamily(type) || 'Noto Serif SC',
        ...template.appearance
      }
      this.appearanceScope = `library-${type}`
      this.draftSavedAt = template.updatedAt || null
      this.initializingDraft = false
    },
    setTemplateName(name: string) {
      if (!this.activeTemplateId || this.initializingDraft) return
      this.activeDraftName = name
      this.templateDirty = true
    },
    async saveTemplate() {
      if (!this.activeTemplateId || this.initializingDraft || this.templateSaving) return
      if (!this.activeDraftName.trim()) throw new Error('模板名称不能为空')
      const session = this.draftSession
      const template = {
        type: this.activeTemplateId,
        name: this.activeDraftName.trim(),
        content: this.MDContent,
        appearance: { ...this.draftAppearance },
        baseTemplate: this.styleTemplate,
        updatedAt: Date.now()
      }
      this.templateSaving = true
      try {
        await saveLibraryTemplate(template)
        if (session === this.draftSession) {
          this.templateDirty =
            this.MDContent !== template.content ||
            this.activeDraftName.trim() !== template.name ||
            JSON.stringify(this.draftAppearance) !== JSON.stringify(template.appearance)
          this.draftSavedAt = template.updatedAt
        }
      } finally {
        if (session === this.draftSession) this.templateSaving = false
      }
    },
    setAppearance(key: string, value: string | undefined, resumeType: string, session: number) {
      if (this.initializingDraft || session !== this.draftSession) return
      if (value === undefined) delete this.draftAppearance[key]
      else this.draftAppearance[key] = value
      if (this.activeTemplateId) {
        this.templateDirty = true
        return
      }
      if (this.activeDraftId) {
        const id = this.activeDraftId
        return updateDraftAppearance(id, this.draftAppearance).then(savedAt => {
          if (session === this.draftSession && savedAt) this.draftSavedAt = savedAt
        })
      }
      if (value === undefined) localStorage.removeItem(`${key}-${resumeType}`)
      else setLocalStorage(`${key}-${resumeType}`, value, null)
    },
    setMDContent(nv: string, resumeType: string, expectedSession?: number) {
      const session = expectedSession ?? this.draftSession
      if (this.initializingDraft || session !== this.draftSession || nv === this.MDContent) return
      this.MDContent = nv
      if (this.activeTemplateId) {
        this.templateDirty = true
        return
      }
      if (this.activeDraftId) {
        const draftId = this.activeDraftId
        return updateDraftContent(draftId, nv).then(savedAt => {
          if (session === this.draftSession && this.activeDraftId === draftId && savedAt) {
            this.draftSavedAt = savedAt
          }
        })
      }
      this.draftSavedAt = Date.now()
      setLocalStorage(`${MARKDOWN_CONTENT}-${resumeType}`, nv, null)
      setLocalStorage(`${MARKDOWN_CONTENT_UPDATED_AT}-${resumeType}`, this.draftSavedAt, null)
    },
    // 切换编辑模式
    setWritableMode(originHTML: HTMLElement) {
      this.writable = !this.writable
      setLocalStorage(WRITABLE, this.writable, null)
      showMessageVN('您已切换至', this.writable ? '内容模式' : 'Markdown模式')
      if (this.writable) {
        nextTick(() => {
          originHTML = originHTML || (document.querySelector('.reference-dom') as HTMLElement)
          originHTML = <HTMLElement>originHTML.cloneNode(true)
          const DOMTree = document.querySelector('.writable-edit-mode') as HTMLElement
          ensureEmptyPreWhiteSpace(originHTML)
          DOMTree && (DOMTree.innerHTML = originHTML.innerHTML)
        })
      }
    },
    setNativeContent(content: string) {
      this.nativeContent = content
    },
    resetNativeContent() {
      this.nativeContent = ''
    }
  }
})

export default () => useEditorStore(pinia)
