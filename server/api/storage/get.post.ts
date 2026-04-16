import { readBody } from 'h3'
import { mapS3Error, sanitizeObjectKey, useS3Storage } from '../../services/s3Storage'

export default defineEventHandler(async (event) => {
  const storage = useS3Storage(event)
  const body = await readBody(event).catch(() => null) as { key?: unknown; expiresIn?: unknown } | null

  const key = sanitizeObjectKey(body?.key)
  const expiresIn = typeof body?.expiresIn === 'number' ? body.expiresIn : undefined

  try {
    return await storage.getSignedGetUrl(key, expiresIn)
  } catch (error) {
    throw mapS3Error(error, 502, 'Failed to build signed URL')
  }
})
