import { createError, readBody } from 'h3'
import { ensurePrefix, mapS3Error, sanitizeObjectKey, useS3Storage } from '../../services/s3Storage'

const ALLOWED_PREFIX = 'product-cards'

export default defineEventHandler(async (event) => {
  const storage = useS3Storage(event)

  const body = await readBody(event).catch(() => null) as { key?: unknown } | null
  const key = ensurePrefix(sanitizeObjectKey(body?.key), ALLOWED_PREFIX)

  try {
    await storage.deleteObject(key)
    return { ok: true as const, key }
  } catch (error) {
    throw mapS3Error(error, 502, 'Upstream DELETE failed')
  }
})
