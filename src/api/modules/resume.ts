export interface IResumeConfig {
  content: string
  style: string
  link: string
  name: string
  type?: number
  width?: number
  height?: number
  autoHeight?: boolean
  assetOrigin?: string
}

export async function resumeExport(data: IResumeConfig) {
  const res = await fetch(import.meta.env.VITE_EXPORT_URL || '/api/export', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000)
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.error || `导出服务不可用（${res.status}），请确认 PDF 服务已启动`)
  }
  if (/application\/pdf|image\/png/.test(res.headers.get('Content-Type') || ''))
    return await res.blob()
  return await res.json()
}
