import { onBeforeMount, onBeforeUnmount, onDeactivated } from 'vue'
import useEditorStore from '@/store/modules/editor'
import { appearanceKeys, scopedAppearanceCSS } from './appearance'

export function useDraftAppearance(template: string) {
  const store = useEditorStore()
  const session = store.draftSession
  const scope = store.appearanceScope
  const key = (name: string) => `${name}-${scope}`
  const name = (cacheKey: string) => cacheKey.slice(0, -(scope.length + 1))
  const active = () => store.draftSession === session && !store.initializingDraft
  const cleanup = () => {
    document.head.querySelectorAll('style').forEach(style => {
      if (appearanceKeys.some(setting => style.hasAttribute(key(setting)))) style.remove()
    })
  }
  onBeforeMount(() => {
    // Also remove styles injected by older versions, including template-wide :root rules.
    document.head.querySelectorAll('style').forEach(style => {
      if (
        Array.from(style.attributes).some(attribute =>
          appearanceKeys.some(setting => attribute.name.startsWith(`${setting.toLowerCase()}-`))
        )
      )
        style.remove()
    })
  })
  onBeforeUnmount(cleanup)
  onDeactivated(cleanup)
  return {
    scope,
    key,
    active,
    get: (cacheKey: string) => store.draftAppearance[name(cacheKey)] ?? false,
    set: (cacheKey: string, value: string) => {
      if (active() && store.draftAppearance[name(cacheKey)] !== value)
        void store.setAppearance(name(cacheKey), value, template, session)
    },
    remove: (cacheKey: string) => {
      if (active()) void store.setAppearance(name(cacheKey), undefined, template, session)
    },
    wrap: (css: string) => scopedAppearanceCSS(css, scope)
  }
}

export type DraftAppearanceContext = ReturnType<typeof useDraftAppearance>
