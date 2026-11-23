import {
  computed,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  Ref,
  ref,
  watch
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'

import { getLocalStorage } from '@/common/localstorage'
import { errorMessage, successMessage, warningMessage } from '@/common/message'
import { download, downloadOfBuffer, importCSS, queryDOM, useLoading } from '@/utils'
import { splitPage } from './components/tabbar/hook'
import useEditorStore from '@/store/modules/editor'
import { convertDOM } from '@/utils/moduleCombine'
import { resumeExport } from '@/api/modules/resume'
import { prepareExport, type PdfPageSize } from '@/common/pdf'
import { templates, resolveTemplateType } from '@/templates/config'
import { appearanceKeys, scopedAppearanceCSS } from '@/common/appearance'
import {
  CUSTOM_CSS_STYLE,
  CUSTOM_MARKDOWN_PRIMARY_COLOR,
  CUSTOM_MARKDOWN_PRIMARY_BG_COLOR,
  MARKDOWN_FONT,
  ADJUST_RESUME_MARGIN_TOP,
  AUTO_ONE_PAGE,
  LINE_HEIGHT
} from './components/tabbar/hook'

export const get = getLocalStorage,
  styleAttrs = [
    CUSTOM_MARKDOWN_PRIMARY_COLOR,
    CUSTOM_MARKDOWN_PRIMARY_BG_COLOR,
    MARKDOWN_FONT,
    LINE_HEIGHT,
    ADJUST_RESUME_MARGIN_TOP, // priority 3 (数字越大 优先级越低)
    AUTO_ONE_PAGE, // priority 2
    CUSTOM_CSS_STYLE // priority 1
  ]

export function useRenderHTML(resumeType: Ref<string>) {
  const renderDOM = ref<HTMLElement>(document.body)
  const editorStore = useEditorStore()
  const session = editorStore.draftSession
  const scope = editorStore.appearanceScope
  const templateStyle = document.createElement('style')
  templateStyle.dataset.resumeTemplate = scope
  let disposed = false
  let paginationTimer: ReturnType<typeof setTimeout>

  onMounted(async () => {
    const css = await importCSS(editorStore.styleTemplate || resumeType.value)
    if (disposed || session !== editorStore.draftSession) return
    // Template styles are owned by this preview rather than accumulating in head
    // through Vite's cached side-effect CSS imports.
    document.head.querySelectorAll<HTMLStyleElement>('style[data-vite-dev-id]').forEach(style => {
      if (/\/templates\/modules\/.*\/style\.scss$/.test(style.dataset.viteDevId || ''))
        style.remove()
    })
    templateStyle.textContent = scopedAppearanceCSS(css, scope)
    const firstAppearance = Array.from(document.head.querySelectorAll('style')).find(style =>
      appearanceKeys.some(key => style.hasAttribute(`${key}-${scope}`))
    )
    document.head.insertBefore(templateStyle, firstAppearance || null)
    renderDOM.value.innerHTML = convertDOM(editorStore.MDContent).innerHTML
    paginationTimer = setTimeout(() => {
      if (!disposed) splitPage(renderDOM.value)
    }, 100)
  })
  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(paginationTimer)
    templateStyle.remove()
  })

  watch(
    () => editorStore.MDContent,
    v => {
      if (disposed || session !== editorStore.draftSession) return
      renderDOM.value.innerHTML = convertDOM(v).innerHTML
      useThrottleFn(() => splitPage(renderDOM.value), 50)()
    }
  )
  return {
    renderDOM
  }
}

export function useResumeType() {
  const route = useRoute()
  const resumeType = computed(() =>
    resolveTemplateType(String(route.query.type || templates.value[0]?.type || 'create'))
  )
  const draftId = computed(() => (route.query.draft ? String(route.query.draft) : undefined))
  return {
    resumeType,
    draftId
  }
}
// 导出简历｜markdown内容
export function useDownLoad(type: Ref<string>) {
  const router = useRouter(),
    editorStore = useEditorStore(),
    { showLoading, closeLoading } = useLoading()
  // 导出PDF & 图片
  const downloadDynamic = async (isPDF: boolean, fileName?: string, pageSize?: PdfPageSize) => {
    showLoading('正在导出请耐心等待...')
    try {
      const { content, style } = await prepareExport(queryDOM('.reference-dom') as HTMLElement)
      const pdfData = await resumeExport({
        content,
        style,
        link: 'none',
        name: type.value,
        type: isPDF ? 0 : 1,
        width: pageSize?.width ?? 210,
        height: pageSize?.height ?? 297,
        autoHeight: pageSize?.autoHeight ?? false,
        assetOrigin: window.location.origin
      })
      const _fileName = (fileName || document.title) + (isPDF ? '.pdf' : '.png')
      if (pdfData instanceof Blob) {
        const url = URL.createObjectURL(pdfData)
        download(url, _fileName)
        URL.revokeObjectURL(url)
      } else {
        const buffer = isPDF ? pdfData.pdf.data : pdfData.picture.data
        downloadOfBuffer(buffer, _fileName, isPDF ? 'application/pdf' : 'image/png')
      }
      successMessage('导出成功～')
    } catch (e: any) {
      const errorMsg =
        e.message == 'Failed to fetch'
          ? '国内导出易出错 请重新尝试 有条件的打开梯子后重试或使用备用导出'
          : e.message || '导出出错 请先尝试备用导出方案'
      errorMessage(errorMsg)
    } finally {
      closeLoading()
    }
  }

  const downloadNative = async () => {
    showLoading('正在准备打印样式…')
    try {
      const snapshot = await prepareExport(queryDOM('.reference-dom') as HTMLElement)
      editorStore.setNativeContent(snapshot.content)
      editorStore.nativeStyle = snapshot.style
      await router.push({ path: '/download', query: { type: type.value } })
    } catch (error: any) {
      errorMessage(error.message || '无法准备导出样式，请重试')
    } finally {
      closeLoading()
    }
  }

  const downloadMD = () => {
    const blob = new Blob([editorStore.MDContent])
    const url = URL.createObjectURL(blob)
    download(url, document.title + '.md')
    URL.revokeObjectURL(url)
    successMessage('导出成功~')
  }
  return {
    downloadMD,
    downloadDynamic,
    downloadNative
  }
}

export function useImportMD(resumeType: Ref<string>) {
  function importMD(file: File) {
    const { writable } = useEditorStore()
    if (writable) {
      return warningMessage('请先切换到Markdown模式')
    }
    const reader = new FileReader(),
      { setMDContent, draftSession } = useEditorStore()
    reader.readAsText(file, 'utf-8')
    reader.onload = function (event) {
      successMessage('导入成功~')
      setMDContent((event.target?.result as string) || '', resumeType.value, draftSession)
    }
    reader.onerror = function () {
      errorMessage('导入失败!')
    }
  }
  return {
    importMD
  }
}

export function useAvatar(resumeType: Ref<string>) {
  const matchAvatarSlot = /!\[个人头像\]\(.*\)/
  function setAvatar(path: string) {
    const { MDContent, setMDContent } = useEditorStore()
    if (!matchAvatarSlot.test(MDContent)) {
      warningMessage('上传前请确保你想上传的位置在编辑器中存在 ![个人头像](...) 此关键字')
      return
    }
    const newContent = MDContent.replace(matchAvatarSlot, `![个人头像](${path})`)
    setMDContent(newContent, resumeType.value)
    successMessage('头像上传成功，如果你想修改为网络图片，你可直接修改对应的链接！')
    // 可能还需要处理可编辑模式中的头像
    const writableDOM = document.querySelector('.writable-edit-mode')
    if (writableDOM) {
      const avatar: HTMLImageElement | null = writableDOM.querySelector('img[alt*=个人头像]')
      avatar && (avatar.src = path)
    }
  }
  return {
    setAvatar
  }
}

export const clickedTarget = ref<HTMLElement | null>()

export function ensureResetClickedTarget() {
  clickedTarget.value = null
}

// 备用导出按钮
export function useShowExport() {
  const showExport = ref(false)

  function setShowExport() {
    const scrollTop = document.body.getBoundingClientRect().top
    if (Math.abs(scrollTop) > 50 && window.innerWidth > 600) {
      showExport.value = true
    } else {
      showExport.value = false
    }
  }

  onActivated(() => {
    document.addEventListener('scroll', useDebounceFn(setShowExport, 400))
  })

  onDeactivated(() => {
    document.removeEventListener('scroll', setShowExport)
  })
  return {
    showExport
  }
}
