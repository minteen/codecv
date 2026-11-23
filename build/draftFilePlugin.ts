import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin } from 'vite'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

const API_PATH = '/api/local-drafts'

function send(response: ServerResponse, status: number, data: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(data))
}

async function readBody(request: IncomingMessage) {
  let body = ''
  for await (const chunk of request) body += chunk
  return JSON.parse(body || '{}')
}

export function draftFilePlugin(root: string): Plugin {
  const draftsDir = join(root, 'drafts')
  return {
    name: 'codecv-local-draft-files',
    configureServer(server) {
      server.middlewares.use(API_PATH, async (request, response) => {
        try {
          await mkdir(draftsDir, { recursive: true })
          const id = new URL(request.url || '/', 'http://localhost').pathname.slice(1)
          if (id && !/^[a-z0-9-]+$/i.test(id)) return send(response, 400, { error: 'Invalid ID' })
          if (request.method === 'GET' && !id) {
            const files = (await readdir(draftsDir)).filter(file => file.endsWith('.json'))
            const drafts = await Promise.all(
              files.map(async file => JSON.parse(await readFile(join(draftsDir, file), 'utf8')))
            )
            return send(
              response,
              200,
              drafts.sort((a, b) => b.updatedAt - a.updatedAt)
            )
          }
          if (request.method === 'GET' && id)
            return send(
              response,
              200,
              JSON.parse(await readFile(join(draftsDir, `${id}.json`), 'utf8'))
            )
          if ((request.method === 'POST' || request.method === 'PUT') && id) {
            const draft = await readBody(request)
            if (draft.id !== id) return send(response, 400, { error: 'Draft ID mismatch' })
            const target = join(draftsDir, `${id}.json`)
            const temporary = join(draftsDir, `.${id}.tmp`)
            await writeFile(temporary, `${JSON.stringify(draft, null, 2)}\n`, 'utf8')
            await rename(temporary, target)
            return send(response, 200, draft)
          }
          if (request.method === 'DELETE' && id) {
            await unlink(join(draftsDir, `${id}.json`))
            return send(response, 200, { success: true })
          }
          send(response, 404, { error: 'Not found' })
        } catch (error: any) {
          send(response, error?.code === 'ENOENT' ? 404 : 500, {
            error: error?.message || 'Draft operation failed'
          })
        }
      })
    }
  }
}
