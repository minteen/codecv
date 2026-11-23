import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

// Publication guardrails: examples must stay synthetic and private runtime data
// must never become candidates for git add.
test('private data, environment files and generated output are ignored', () => {
  for (const path of [
    'drafts/example.json',
    'template-library/example.json',
    'local-private/example.png',
    'tmp/pdfs/example.pdf',
    'dist/index.html',
    '.env.local',
    '.env.production',
    'src/assets/svg/identify.svg',
    'pdf-service/node_modules/example/index.js'
  ]) {
    assert.equal(
      execFileSync('git', ['check-ignore', '--no-index', path], { encoding: 'utf8' }).trim(),
      path
    )
  }
})

test('bundled resume examples contain only fictional contact information', async () => {
  const directories = await readdir('src/templates/modules')
  for (const directory of directories.filter(name => name !== 'create')) {
    const source = await readFile(`src/templates/modules/${directory}/index.ts`, 'utf8')
    assert.match(source, /# 示例姓名/)
    assert.doesNotMatch(source, /\b1[3-9]\d{9}\b/)
    assert.doesNotMatch(source, /data:image\/[a-z+]+;base64,/i)
    const emails = source.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || []
    assert.ok(emails.every(email => email.endsWith('@example.com')))
  }
})

test('test commands never publish changes', async () => {
  const { scripts } = JSON.parse(await readFile('package.json', 'utf8'))
  assert.doesNotMatch(scripts.test, /\bgit\s+(add|commit|push)\b/)
  assert.equal(scripts.push, undefined)
})
