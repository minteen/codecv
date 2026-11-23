import { getLocalStorage } from './localstorage'

export type ResumeAppearance = Record<string, string>
export const appearanceKeys = [
  'custom-markdown-primary-color',
  'custom_markdown_primary_bg_color',
  'markdown-font',
  'Line_Height',
  'ADJUST_RESUME_MARGIN_TOP',
  'auto-one-page',
  'custom-css-style'
] as const

// Import the old template settings once; new drafts explicitly start with {}.
export function legacyAppearance(template: string): ResumeAppearance {
  return Object.fromEntries(
    appearanceKeys.flatMap(key => {
      const value = getLocalStorage(`${key}-${template}`)
      return value === false ? [] : [[key, String(value)]]
    })
  )
}

export function appearanceScope(draftId: string | null, template: string) {
  return draftId ? `draft-${draftId}` : `template-${template}`
}

export function scopedAppearanceCSS(css: string, scope: string) {
  // @scope keeps arbitrary custom selectors and nested media rules inside this
  // resume, including exported clones. Root variables belong to the resume too.
  return `@scope ([data-resume-scope=${JSON.stringify(scope)}]) { ${css.replace(
    /:root\b/g,
    ':scope'
  )} }`
}
