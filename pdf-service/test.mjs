import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, dimensions, renderPdf } from './server.mjs'

test('defaults and invalid page dimensions', () => {
  assert.deepEqual(dimensions({}), { width: 210, height: 297 })
  for (const width of [0, -1, 2001, '210', NaN, Infinity]) {
    assert.throws(() => dimensions({ width }))
  }
  assert.throws(() => dimensions({ autoHeight: 'true' }))
})

test('API rejects malformed input and cross-origin browser access', async () => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const endpoint = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(endpoint + '/health')).status, 200)
    assert.equal(
      (await fetch(endpoint + '/api/export', { method: 'POST', body: '{}' })).status,
      400
    )
    assert.equal(
      (
        await fetch(endpoint + '/api/export', {
          method: 'POST',
          body: '{}',
          headers: { Origin: 'https://example.com' }
        })
      ).status,
      403
    )
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('Chromium generates Chinese PDF in A4, custom width/height and PNG', async () => {
  const common = {
    assetOrigin: 'http://localhost:5174',
    content:
      '<main class="jufe"><h1>简历导出测试</h1><p>中文字体与页面尺寸验证 · PDF export</p><section style="height:280mm;background:#fff5ed">项目经历</section><h2>第二页内容</h2></main>',
    style:
      'body{font-family:"PingFang SC",sans-serif;color:#333}.jufe{padding:10mm}h1{color:#c45f35}'
  }
  await mkdir('../tmp/pdfs', { recursive: true })
  for (const [name, size] of [
    ['a4', { width: 210, height: 297 }],
    ['custom', { width: 180, height: 240 }]
  ]) {
    const pdf = await renderPdf({ ...common, ...size })
    assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-')
    await writeFile(`../tmp/pdfs/${name}.pdf`, pdf)
  }
  const png = await renderPdf({ ...common, type: 1 })
  assert.equal(Buffer.from(png).subarray(1, 4).toString(), 'PNG')
})

function pageCount(pdf) {
  return (
    Buffer.from(pdf)
      .toString('latin1')
      .match(/\/Type\s*\/Page\b/g) || []
  ).length
}

function pageSize(pdf) {
  const match = Buffer.from(pdf)
    .toString('latin1')
    .match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/)
  assert.ok(match, 'Chromium PDF should declare page dimensions')
  return match.slice(1).map(Number)
}

test('auto height extends slightly overflowing A4 into one page without changing width', async () => {
  const data = {
    assetOrigin: 'http://localhost:5174',
    width: 210,
    height: 297,
    content:
      '<main class="jufe pdf-resume"><h1>稍超一页的简历</h1><section></section><p>最后一行必须完整保留</p></main>',
    style:
      'body,h1,p{margin:0}.jufe{padding:5mm}h1,p{height:10mm;font:14px sans-serif}section{height:280mm}'
  }
  const fixed = await renderPdf(data)
  const extended = await renderPdf({ ...data, autoHeight: true })
  assert.equal(pageCount(fixed), 2)
  assert.equal(pageCount(extended), 1)
  const [width, height] = pageSize(extended)
  assert.ok(Math.abs((width * 25.4) / 72 - 210) < 0.5)
  assert.ok((height * 25.4) / 72 > 307 && (height * 25.4) / 72 < 315)
  await writeFile('../tmp/pdfs/auto-height.pdf', extended)
  const short = await renderPdf({
    ...data,
    content: '<main class="jufe"><h1>短简历</h1></main>',
    autoHeight: true
  })
  assert.ok(Math.abs((pageSize(short)[1] * 25.4) / 72 - 297) < 0.5)
})

test('missing avatar fails explicitly rather than silently exporting a different resume', async () => {
  await assert.rejects(
    renderPdf({
      assetOrigin: 'http://localhost:5174',
      content: '<main class="jufe"><img src="data:image/png;base64,invalid"></main>'
    })
  )
})
