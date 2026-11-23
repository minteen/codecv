import type { Plugin } from 'vite'
import { mkdir, readFile, readdir, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export function templateFilePlugin(root: string): Plugin {
  const directory = join(root, 'template-library')
  return {
    name: 'codecv-local-template-files',
    configureServer(server) {
      server.middlewares.use('/api/local-templates', async (request, response) => {
        const send = (status: number, value: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify(value))
        }
        try {
          await mkdir(directory, { recursive: true })
          const type = new URL(request.url || '/', 'http://localhost').pathname.slice(1)
          if (type && !/^[a-z0-9_-]+$/i.test(type))
            return send(400, { error: 'Invalid template ID' })
          if (request.method === 'GET' && !type) {
            const files = (await readdir(directory)).filter(file => file.endsWith('.json'))
            return send(
              200,
              await Promise.all(
                files.map(async file => JSON.parse(await readFile(join(directory, file), 'utf8')))
              )
            )
          }
          if (request.method === 'PUT' && type) {
            let body = ''
            for await (const chunk of request) {
              body += chunk
              if (Buffer.byteLength(body) > 20 * 1024 * 1024)
                return send(413, { error: 'Template too large' })
            }
            const template = JSON.parse(body)
            if (
              template.type !== type ||
              typeof template.name !== 'string' ||
              !template.name.trim() ||
              typeof template.content !== 'string' ||
              typeof template.baseTemplate !== 'string' ||
              !/^[a-z0-9_-]+$/i.test(template.baseTemplate) ||
              !template.appearance ||
              typeof template.appearance !== 'object' ||
              Array.isArray(template.appearance) ||
              Object.values(template.appearance).some(value => typeof value !== 'string') ||
              (template.deleted !== undefined && typeof template.deleted !== 'boolean')
            )
              return send(400, { error: 'Invalid template' })
            const temporary = join(directory, `.${type}-${randomUUID()}.tmp`)
            await writeFile(temporary, JSON.stringify(template, null, 2) + '\n', 'utf8')
            await rename(temporary, join(directory, `${type}.json`))
            return send(200, template)
          }
          send(404, { error: 'Not found' })
        } catch (error: any) {
          send(error instanceof SyntaxError ? 400 : 500, {
            error: error.message || 'Template operation failed'
          })
        }
      })
    }
  }
}
