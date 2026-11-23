export interface PdfPageSize {
  width: number
  height: number
  autoHeight?: boolean
}

// Shared by browser print and server export. The service only changes the page dimensions.
export const exportLayout = `
  @page { size: 210mm 297mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: white; }
  *, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdf-resume { width: 210mm !important; min-height: 0 !important; height: auto !important;
    margin: 0 !important; transform: none !important; position: relative !important;
    top: auto !important; left: auto !important; box-sizing: border-box; }
`

async function asDataUrl(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('无法加载导出资源，请稍后重试')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Flatten imports in place and embed fonts already used by this browser. No late @import
// or a second machine's fallback fonts can change the exported resume's typography.
export async function collectExportStyles() {
  await document.fonts.ready
  const loadedFonts: FontFace[] = []
  document.fonts.forEach(font => {
    if (font.status === 'loaded') loadedFonts.push(font)
  })
  const normalize = (value: string) => value.replace(/["'\s]/g, '').toLowerCase()
  const resources = new Map<string, Promise<string>>()
  async function urls(text: string, base: string, embed = false) {
    const matches = Array.from(text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g))
    const replacements = await Promise.all(
      matches.map(async match => {
        const url = new URL(match[2], base).href
        if (!embed || url.startsWith('data:')) return `url(${JSON.stringify(url)})`
        if (!resources.has(url)) resources.set(url, asDataUrl(url))
        return `url(${JSON.stringify(await resources.get(url))})`
      })
    )
    let index = 0
    return text.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, () => replacements[index++])
  }
  async function ruleText(rule: CSSRule, base: string): Promise<string> {
    if (rule instanceof CSSImportRule) {
      const css = rule.styleSheet ? await sheetText(rule.styleSheet) : await remoteSheet(rule.href)
      return rule.media.mediaText ? `@media ${rule.media.mediaText}{${css}}` : css
    }
    if (rule instanceof CSSFontFaceRule) {
      const family = normalize(rule.style.getPropertyValue('font-family'))
      const range = normalize(rule.style.getPropertyValue('unicode-range') || 'U+0-10FFFF')
      if (
        !loadedFonts.some(
          font => normalize(font.family) === family && normalize(font.unicodeRange) === range
        )
      )
        return ''
      return await urls(rule.cssText, base, true)
    }
    return await urls(rule.cssText, base)
  }
  async function remoteSheet(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('无法加载导出样式，请稍后重试')
    const text = await response.text()
    // Resolve nested imports before CSSStyleSheet drops them from constructed sheets.
    const imports = Array.from(
      text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/g)
    )
    const expanded = await Promise.all(
      imports.map(async match => {
        const css = await remoteSheet(new URL(match[1], url).href)
        return match[2].trim() ? `@media ${match[2]}{${css}}` : css
      })
    )
    let index = 0
    const flattened = text.replace(
      /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/g,
      () => expanded[index++]
    )
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(flattened)
    return (await Promise.all(Array.from(sheet.cssRules).map(rule => ruleText(rule, url)))).join(
      '\n'
    )
  }
  async function sheetText(sheet: CSSStyleSheet): Promise<string> {
    let rules: CSSRule[]
    try {
      rules = Array.from(sheet.cssRules)
    } catch {
      if (!sheet.href) throw new Error('无法读取简历样式')
      return await remoteSheet(sheet.href)
    }
    return (
      await Promise.all(rules.map(rule => ruleText(rule, sheet.href || document.baseURI)))
    ).join('\n')
  }
  const root = getComputedStyle(document.documentElement)
  const variables = Array.from(root)
    .filter(name => name.startsWith('--'))
    .map(name => `${name}:${root.getPropertyValue(name)};`)
    .join('')
  const styles = await Promise.all(
    Array.from(document.styleSheets)
      .filter(sheet => !sheet.disabled)
      .map(sheetText)
  )
  return `${styles.join('\n')}\n:root{${variables}}\n${exportLayout}`
}

export async function prepareExport(source: HTMLElement) {
  const style = await collectExportStyles()
  const content = source.cloneNode(true) as HTMLElement
  content.classList.remove('reference-dom')
  content.classList.add('pdf-resume')
  // Remove editor pagination spacers; native printing handles page breaks itself.
  content.querySelectorAll('[white-space]').forEach(element => element.remove())
  await Promise.all(
    Array.from(content.querySelectorAll('img')).map(async image => {
      // Embed avatars too, including browser-owned blob URLs.
      image.src = await asDataUrl(image.src)
      image.removeAttribute('srcset')
      image.loading = 'eager'
    })
  )
  const host = document.createElement('div')
  const scope = source.closest('[data-resume-scope]')?.getAttribute('data-resume-scope')
  if (scope) host.setAttribute('data-resume-scope', scope)
  host.append(content)
  return { content: host.outerHTML, style }
}
