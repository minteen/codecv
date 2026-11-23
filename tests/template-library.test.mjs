import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'

test('template library persists edits and additions, with offline recovery and explicit write errors', async t => {
  const root = await mkdtemp(join(tmpdir(), 'codecv-templates-'))
  const output = join(root, 'runtime.mjs')
  await build({
    stdin: {
      contents: `export * from './src/common/templateLibrary.ts'; export {templateFilePlugin} from './build/templateFilePlugin.ts'; export {templates,loadTemplateLibrary,removeLibraryTemplate,templateLabels} from './src/templates/config.ts'`,
      resolveDir: resolve('.'),
      loader: 'ts'
    },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    plugins: [
      {
        name: 'bundled-template-fixture',
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, args => ({
            path: resolve('src', args.path.slice(2) + '.ts')
          }))
          builder.onLoad({ filter: /src\/templates\/config\.ts$/ }, async args => ({
            contents: (await readFile(args.path, 'utf8')).replace(
              "import.meta.glob('./modules/*/index.ts', { eager: true })",
              "({'./modules/27test/index.ts':{default:{name:'Built-in template',content:'# Built-in',primaryColor:'#333',primaryBackground:'#333',font:'sans-serif',img:''}}})"
            ),
            loader: 'ts',
            resolveDir: resolve('src/templates')
          }))
        }
      }
    ]
  })
  const runtime = await import(output)
  const storage = new Map()
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  }
  let middleware
  runtime.templateFilePlugin(root).configureServer({
    middlewares: {
      use: (_path, handler) => {
        middleware = handler
      }
    }
  })
  let failWrites = false
  const server = createServer((request, response) => {
    if (failWrites && request.method === 'PUT') {
      response.writeHead(500)
      response.end('{}')
      return
    }
    request.url = request.url.replace('/api/local-templates', '') || '/'
    middleware(request, response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const nativeFetch = globalThis.fetch
  const base = `http://127.0.0.1:${server.address().port}`
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options)
  t.after(async () => {
    globalThis.fetch = nativeFetch
    delete globalThis.localStorage
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  })
  const template = {
    type: 'custom-test',
    name: 'Test template',
    content: '# Original',
    baseTemplate: 'create',
    appearance: { 'custom-css-style': '.jufe h2 { color: red }' },
    updatedAt: 1
  }
  await runtime.writeTemplate(template)
  assert.deepEqual(await runtime.readTemplateLibrary(), [template])
  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'template-library/custom-test.json'), 'utf8')),
    template
  )
  await Promise.all([
    runtime.writeTemplate({ ...template, content: '# First edit', updatedAt: 2 }),
    runtime.writeTemplate({ ...template, content: '# Latest edit', updatedAt: 3 })
  ])
  assert.equal((await runtime.readTemplateLibrary())[0].content, '# Latest edit')
  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  await runtime.writeTemplate({ ...template, content: '# Offline edit', updatedAt: 4 })
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options)
  assert.equal((await runtime.readTemplateLibrary())[0].content, '# Offline edit')
  assert.equal(
    JSON.parse(await readFile(join(root, 'template-library/custom-test.json'), 'utf8')).content,
    '# Offline edit'
  )
  failWrites = true
  await assert.rejects(runtime.writeTemplate({ ...template, updatedAt: 5 }), /模板保存失败/)
  failWrites = false
  const response = await nativeFetch(`${base}/api/local-templates/invalid.id`, {
    method: 'PUT',
    body: JSON.stringify(template)
  })
  assert.equal(response.status, 400)
  const invalid = await nativeFetch(`${base}/api/local-templates/mismatch`, {
    method: 'PUT',
    body: JSON.stringify(template)
  })
  assert.equal(invalid.status, 400)
  // Deleted custom templates and bundled templates remain deleted after refresh.
  await runtime.loadTemplateLibrary()
  assert.ok(runtime.templates.value.some(item => item.type === 'custom-test'))
  await runtime.removeLibraryTemplate('custom-test')
  await runtime.loadTemplateLibrary()
  assert.equal(
    runtime.templates.value.some(item => item.type === 'custom-test'),
    false
  )
  const deleted = JSON.parse(
    await readFile(join(root, 'template-library/custom-test.json'), 'utf8')
  )
  assert.equal(deleted.deleted, true)
  assert.equal(deleted.content, '')
  assert.deepEqual(deleted.appearance, {})
  // An old cached offline edit cannot revive a remotely deleted template.
  storage.set(
    'resume-template-library',
    JSON.stringify({ value: [{ ...template, updatedAt: 4 }], expires: null })
  )
  await runtime.loadTemplateLibrary()
  assert.equal(
    runtime.templates.value.some(item => item.type === 'custom-test'),
    false
  )
  assert.equal(runtime.templateLabels.value['custom-test'], 'Test template')
  await runtime.removeLibraryTemplate('27test')
  await runtime.loadTemplateLibrary()
  assert.deepEqual(runtime.templates.value, [])
  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  await runtime.loadTemplateLibrary()
  assert.deepEqual(runtime.templates.value, [])
})
