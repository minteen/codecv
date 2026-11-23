import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

// Exercise the real editor page's route watcher, Pinia store, draft API and
// file middleware. Only browser presentation dependencies are stubbed.
test('draft editing stays isolated across cached-page navigation and async loads', async t => {
  const root = await mkdtemp(join(tmpdir(), 'codecv-isolation-'))
  const output = join(root, 'runtime.mjs')
  const project = resolve('.')
  await build({
    stdin: {
      contents: `
        export { default as useEditorStore } from './src/store/modules/editor.ts'
        export * from './src/common/drafts.ts'
        export { draftFilePlugin } from './build/draftFilePlugin.ts'
        export { createRenderer, reactive, nextTick } from 'vue'
        export { default as EditorPage } from './src/views/editor/editor.vue'
        export { templates } from './src/templates/config.ts'
      `,
      resolveDir: project,
      loader: 'ts'
    },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    plugins: [
      {
        name: 'browser-presentation-stubs',
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, args => ({
            path: resolve(
              project,
              'src',
              args.path === '@/store'
                ? 'store/index.ts'
                : args.path.slice(2) + (args.path.endsWith('.vue') ? '' : '.ts')
            )
          }))
          builder.onResolve({ filter: /^vue-router$/ }, () => ({
            path: 'router',
            namespace: 'stub'
          }))
          builder.onResolve({ filter: /^element-plus/ }, args => ({
            path: args.path,
            namespace: 'element-stub'
          }))
          builder.onLoad({ filter: /.*/, namespace: 'element-stub' }, args => ({
            contents:
              args.path === 'element-plus'
                ? 'export const ElMessageBox = {confirm: async () => {}}'
                : ''
          }))
          builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents:
              'export const useRoute = () => globalThis.__draftTestRoute; export const onBeforeRouteLeave = () => {}; export const onBeforeRouteUpdate = () => {}'
          }))
          builder.onLoad({ filter: /src\/templates\/config\.ts$/ }, () => ({
            contents:
              "export const templates = { value: [{type:'same-template',name:'Template',content:'template default',appearance:{}}] }; export const loadTemplateLibrary=async()=>{}; export const saveLibraryTemplate=async(template)=>{const index=templates.value.findIndex(item=>item.type===template.type); templates.value[index]=JSON.parse(JSON.stringify(template));}; export const getPrimaryColor=()=> '#333'; export const getPrimaryBGColor=()=> '#3478d4'; export const getFontFamily=()=> 'Noto Sans SC'; export const resolveTemplateType=type=>type"
          }))
          builder.onLoad({ filter: /src\/common\/message\.ts$/ }, () => ({
            contents: 'export const showMessageVN = () => {}'
          }))
          builder.onLoad({ filter: /components\/tabbar\/hook\.ts$/ }, () => ({
            contents: 'export const ensureEmptyPreWhiteSpace = () => {}'
          }))
          builder.onLoad({ filter: /components\/guide\/guide\.ts$/ }, () => ({
            contents: 'export const startGuide = () => {}'
          }))
          builder.onLoad({ filter: /src\/views\/editor\/hook\.ts$/ }, () => ({
            contents: `
          import { computed } from 'vue'
          export const useResumeType = () => ({ resumeType: computed(() => globalThis.__draftTestRoute.query.type) })
          export const useDownLoad = () => ({})
          export const useImportMD = () => ({})
          export const useAvatar = () => ({})
          export const useShowExport = () => ({})
        `
          }))
          builder.onLoad({ filter: /\.vue$/ }, async args => {
            if (args.path !== resolve(project, 'src/views/editor/editor.vue'))
              return { contents: 'export default {}' }
            const { descriptor } = parse(await readFile(args.path, 'utf8'))
            const script = compileScript(descriptor, { id: 'isolation-test' })
            return {
              contents: script.content,
              loader: 'ts',
              resolveDir: resolve(project, 'src/views/editor')
            }
          })
        }
      }
    ]
  })
  const runtime = await import(output)
  const storage = new Map()
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  }
  let middleware
  runtime.draftFilePlugin(root).configureServer({
    middlewares: {
      use: (_path, handler) => {
        middleware = handler
      }
    }
  })
  const server = createServer((request, response) => {
    request.url = request.url.replace('/api/local-drafts', '') || '/'
    middleware(request, response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const nativeFetch = globalThis.fetch
  const base = `http://127.0.0.1:${server.address().port}`
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options)
  t.after(async () => {
    globalThis.fetch = nativeFetch
    await new Promise(resolve => server.close(resolve))
    delete globalThis.localStorage
    delete globalThis.__draftTestRoute
    await rm(root, { recursive: true, force: true })
  })
  const a = await runtime.createDraft('same-template', 'A', 'A original')
  const b = await runtime.copyDraft(a.id)
  const store = runtime.useEditorStore()
  const route = runtime.reactive({ path: '/home', fullPath: '/home', query: {} })
  globalThis.__draftTestRoute = route
  const renderer = runtime.createRenderer({
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: () => null,
    nextSibling: () => null
  })
  const app = renderer.createApp({ ...runtime.EditorPage, render: () => null })
  app.mount({})
  t.after(() => {
    app.unmount()
    delete globalThis.window
  })
  const navigate = async draft => {
    route.path = draft ? '/editor' : '/home'
    route.query = draft ? { type: draft.templateType, draft: draft.id } : {}
    route.fullPath = draft ? `/editor?type=${draft.templateType}&draft=${draft.id}` : '/home'
    await runtime.nextTick()
    if (draft) {
      for (let attempt = 0; attempt < 100 && store.initializingDraft; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      assert.equal(store.initializingDraft, false, 'route must finish loading')
      assert.equal(store.activeDraftId, draft.id)
    }
  }
  await t.test('A → home → B with the same template binds a different file', async () => {
    await navigate(a)
    await store.setMDContent('A edited', 'same-template')
    await navigate(null)
    await navigate(b)
    assert.equal(store.MDContent, 'A original')
    await store.setMDContent('B edited', 'same-template')
    assert.equal((await runtime.getDraft(a.id)).content, 'A edited')
    assert.equal((await runtime.getDraft(b.id)).content, 'B edited')
    assert.equal(
      (await readdir(join(root, 'drafts'))).filter(name => name.endsWith('.json')).length,
      2
    )
  })
  await t.test('direct query change and late editor events stay isolated', async () => {
    const oldSession = store.draftSession
    await navigate(a)
    await store.setMDContent('late B event', 'same-template', oldSession)
    assert.equal(store.MDContent, 'A edited')
    assert.equal((await runtime.getDraft(a.id)).content, 'A edited')
  })
  await t.test('a delayed old load cannot replace the newly selected draft', async () => {
    let release
    const delayed = new Promise(resolve => {
      release = resolve
    })
    const liveFetch = globalThis.fetch
    globalThis.fetch = async (url, options) => {
      if (url.endsWith(`/${a.id}`) && !options) await delayed
      return liveFetch(url, options)
    }
    const oldLoad = store.initMDContent('same-template', a.id)
    await store.initMDContent('same-template', b.id)
    release()
    await oldLoad
    globalThis.fetch = liveFetch
    assert.equal(store.activeDraftId, b.id)
    assert.equal(store.MDContent, 'B edited')
  })
  await t.test('missing drafts cannot fall back to or overwrite another draft', async () => {
    await assert.rejects(store.initMDContent('same-template', 'missing-draft'))
    await store.setMDContent('must not be saved', 'same-template')
    assert.equal(store.activeDraftId, null)
    assert.equal(store.initializingDraft, true)
    assert.equal((await runtime.getDraft(b.id)).content, 'B edited')
  })
  await t.test('reopening waits for a pending save; empty content persists', async () => {
    await store.initMDContent('same-template', a.id)
    const saving = store.setMDContent('', 'same-template')
    await store.initMDContent('same-template', a.id)
    await saving
    assert.equal(store.MDContent, '')
    assert.equal((await runtime.getDraft(a.id)).content, '')
    assert.equal((await runtime.getDraft(b.id)).content, 'B edited')
  })
  await t.test('appearance is per draft and concurrent content saves preserve it', async () => {
    await store.initMDContent('same-template', a.id)
    const session = store.draftSession
    const margin = '.jufe h2 { margin-top: 35px !important; }'
    const appearanceSave = store.setAppearance(
      'ADJUST_RESUME_MARGIN_TOP',
      margin,
      'same-template',
      session
    )
    const contentSave = store.setMDContent('A styled', 'same-template', session)
    await Promise.all([appearanceSave, contentSave])
    assert.equal((await runtime.getDraft(a.id)).appearance.ADJUST_RESUME_MARGIN_TOP, margin)
    assert.equal((await runtime.getDraft(a.id)).content, 'A styled')
    await store.initMDContent('same-template', b.id)
    assert.equal(store.draftAppearance.ADJUST_RESUME_MARGIN_TOP, undefined)
    await store.setAppearance('ADJUST_RESUME_MARGIN_TOP', 'late A event', 'same-template', session)
    assert.equal((await runtime.getDraft(b.id)).appearance.ADJUST_RESUME_MARGIN_TOP, undefined)
    await store.initMDContent('same-template', a.id)
    assert.equal(store.draftAppearance.ADJUST_RESUME_MARGIN_TOP, margin)
  })
  await t.test('copies inherit appearance once and later changes stay independent', async () => {
    const copying = store.setAppearance(
      'markdown-font',
      'Noto Serif SC',
      'same-template',
      store.draftSession
    )
    const copy = await runtime.copyDraft(a.id)
    await copying
    assert.equal(copy.appearance['markdown-font'], 'Noto Serif SC')
    await store.initMDContent('same-template', copy.id)
    await store.setAppearance('markdown-font', 'Nunito', 'same-template', store.draftSession)
    assert.equal((await runtime.getDraft(a.id)).appearance['markdown-font'], 'Noto Serif SC')
    assert.equal((await runtime.getDraft(copy.id)).appearance['markdown-font'], 'Nunito')
    await store.setAppearance('markdown-font', undefined, 'same-template', store.draftSession)
    assert.equal((await runtime.getDraft(copy.id)).appearance['markdown-font'], undefined)
    assert.equal((await runtime.getDraft(a.id)).appearance['markdown-font'], 'Noto Serif SC')
  })
  await t.test(
    'legacy settings migrate once; new drafts do not share template preferences',
    async () => {
      storage.set(
        'markdown-font-same-template',
        JSON.stringify({ value: 'Noto Serif SC', expires: null })
      )
      const old = { ...(await runtime.getDraft(a.id)), id: 'legacy-draft', appearance: undefined }
      await nativeFetch(`${base}/api/local-drafts/${old.id}`, {
        method: 'PUT',
        body: JSON.stringify(old)
      })
      await store.initMDContent('same-template', old.id)
      assert.equal(store.draftAppearance['markdown-font'], 'Noto Serif SC')
      storage.set('markdown-font-same-template', JSON.stringify({ value: 'Nunito', expires: null }))
      await store.initMDContent('same-template', old.id)
      assert.equal(store.draftAppearance['markdown-font'], 'Noto Serif SC')
      const fresh = await runtime.createDraft('same-template', 'Fresh', 'new')
      await store.initMDContent('same-template', fresh.id)
      assert.deepEqual(store.draftAppearance, {})
    }
  )
  await t.test(
    'template edits save separately and new resumes inherit a frozen appearance snapshot',
    async () => {
      const before = (await readdir(join(root, 'drafts'))).filter(name =>
        name.endsWith('.json')
      ).length
      await store.initTemplate('same-template')
      assert.equal(store.activeDraftId, null)
      assert.equal(store.activeTemplateId, 'same-template')
      const session = store.draftSession
      await store.setMDContent('new template content', 'same-template', session)
      await store.setAppearance(
        'custom-css-style',
        '.jufe h2 {color:red}',
        'same-template',
        session
      )
      store.setTemplateName('Edited template')
      assert.equal(store.templateDirty, true)
      assert.equal(
        (await readdir(join(root, 'drafts'))).filter(name => name.endsWith('.json')).length,
        before
      )
      await store.saveTemplate()
      assert.equal(store.templateDirty, false)
      await store.initTemplate('same-template')
      assert.equal(store.MDContent, 'new template content')
      assert.equal(store.activeDraftName, 'Edited template')
      assert.equal(store.draftAppearance['custom-css-style'], '.jufe h2 {color:red}')
      const saved = runtime.templates.value[0]
      const resume = await runtime.createDraft(saved.type, saved.name, saved.content, {
        appearance: saved.appearance,
        baseTemplate: saved.baseTemplate
      })
      await store.setMDContent('later template content', 'same-template', store.draftSession)
      await store.setAppearance(
        'custom-css-style',
        '.jufe h2 {color:blue}',
        'same-template',
        store.draftSession
      )
      await store.saveTemplate()
      await store.initMDContent('same-template', resume.id)
      assert.equal(store.MDContent, 'new template content')
      assert.equal(store.draftAppearance['custom-css-style'], '.jufe h2 {color:red}')
      assert.equal(store.activeTemplateId, null)
      assert.equal((await runtime.getDraft(a.id)).content, 'A styled')
    }
  )
})
