import http from 'node:http'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

export function dimensions(data) {
  const width = data.width ?? 210
  const height = data.height ?? 297
  if (
    ![width, height].every(
      value => typeof value === 'number' && Number.isFinite(value) && value >= 50 && value <= 2000
    )
  ) {
    throw new Error('页宽、页高必须是 50～2000 mm 之间的数字')
  }
  if (data.autoHeight !== undefined && typeof data.autoHeight !== 'boolean')
    throw new Error('自动延长纸张选项必须是布尔值')
  return { width, height }
}

function executablePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome'
  ]
  const found = candidates.find(path => path && existsSync(path))
  if (!found) throw new Error('未找到 Chromium，请安装 Chrome 或设置 CHROME_PATH')
  return found
}

export async function renderPdf(data) {
  const { width } = dimensions(data)
  let { height } = dimensions(data)
  if (typeof data.content !== 'string' || !data.content.trim()) throw new Error('简历内容不能为空')
  const origin = new URL(data.assetOrigin).origin
  const allowed = new Set([
    origin,
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://at.alicdn.com'
  ])
  for (const entry of (process.env.ASSET_ORIGINS || '').split(',').filter(Boolean))
    allowed.add(new URL(entry).origin)
  const browser = await puppeteer.launch({ executablePath: executablePath(), headless: true })
  const deadline = setTimeout(() => {
    void browser.close()
  }, 45000)
  try {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    await page.setViewport({ width: Math.ceil((width * 96) / 25.4), height: 1123 })
    await page.setRequestInterception(true)
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.protocol === 'data:' || url.protocol === 'about:' || allowed.has(url.origin))
        request.continue()
      else request.abort()
    })
    // App styles are inserted as DOM text after parsing, so CSS cannot escape a style tag.
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
    )
    await page.emulateMediaType(data.type === 1 ? 'screen' : 'print')
    await page.evaluate(
      ({ content, style, origin, width, height }) => {
        const base = document.createElement('base')
        base.href = origin + '/'
        document.head.append(base)
        const styles = document.createElement('style')
        styles.textContent = style || ''
        document.head.append(styles)
        document.body.innerHTML = content
        const overrides = document.createElement('style')
        overrides.textContent = `
        @page { size: ${width}mm ${height}mm; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; width: ${width}mm; background: white; }
        *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .jufe.pdf-resume, body > .jufe { width: ${width}mm !important; min-height: 0 !important; height: auto !important; margin: 0 !important; transform: none !important; position: relative !important; top: auto !important; left: auto !important; }
      `
        document.head.append(overrides)
      },
      { content: data.content, style: data.style, origin, width, height }
    )
    // Never silently print fallback fonts or missing avatars. A failed resource is an
    // actionable export error, rather than a successful but visually different PDF.
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images).map(image => image.decode()))
      if (Array.from(document.fonts).some(font => font.status === 'error'))
        throw new Error('导出字体加载失败，请返回编辑器重试')
    })
    if (data.type === 1) return await page.screenshot({ type: 'png', fullPage: true })
    if (data.autoHeight) {
      const pixels = await page.evaluate(() => {
        const style = document.createElement('style')
        style.textContent =
          '.jufe * { break-before: auto !important; break-after: auto !important; }'
        document.head.append(style)
        const resume = document.querySelector('.pdf-resume') || document.querySelector('.jufe')
        if (!resume) throw new Error('未找到简历内容')
        return Math.max(resume.getBoundingClientRect().height, resume.scrollHeight)
      })
      // Round up with a small allowance for Chromium's CSS-pixel/point rounding.
      height = Math.max(height, Math.ceil(((pixels * 25.4) / 96 + 0.5) * 10) / 10)
      if (height > 2000) throw new Error('内容超过单页 2000 mm 上限，请关闭自动延长纸张并分页导出')
      await page.addStyleTag({ content: `@page { size: ${width}mm ${height}mm; margin: 0; }` })
    }
    return await page.pdf({
      width: `${width}mm`,
      height: `${height}mm`,
      printBackground: true,
      preferCSSPageSize: true,
      waitForFonts: true,
      timeout: 30000
    })
  } finally {
    clearTimeout(deadline)
    await browser.close()
  }
}

export function createServer() {
  let busy = false
  return http.createServer(async (request, response) => {
    const json = (status, error) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error }))
    }
    if (request.url === '/health' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      return response.end('{"ok":true}')
    }
    if (request.url !== '/api/export' || request.method !== 'POST') return json(404, '接口不存在')
    // Local service: reject browser cross-origin requests; Vite/server proxies omit Origin.
    if (request.headers.origin) return json(403, '请通过项目同源代理访问导出服务')
    if (busy) return json(429, '已有导出任务，请稍后重试')
    busy = true
    try {
      let length = 0
      const chunks = []
      for await (const chunk of request) {
        length += chunk.length
        if (length > 20 * 1024 * 1024) return json(413, '简历内容超过 20 MB')
        chunks.push(chunk)
      }
      let data
      try {
        data = JSON.parse(Buffer.concat(chunks).toString())
        dimensions(data)
        if (!data.content || typeof data.content !== 'string') throw new Error('简历内容不能为空')
        if (!['http:', 'https:'].includes(new URL(data.assetOrigin).protocol))
          throw new Error('资源地址无效')
      } catch (error) {
        return json(400, error.message)
      }
      const pdf = await renderPdf(data)
      response.writeHead(200, {
        'Content-Type': data.type === 1 ? 'image/png' : 'application/pdf',
        'Content-Disposition':
          'attachment; filename="resume.' + (data.type === 1 ? 'png' : 'pdf') + '"',
        'Cache-Control': 'no-store'
      })
      response.end(pdf)
    } catch (error) {
      console.error('PDF export failed:', error.message)
      json(500, error.message)
    } finally {
      busy = false
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001)
  createServer().listen(port, '127.0.0.1', () =>
    console.log(`PDF service: http://127.0.0.1:${port}`)
  )
}
