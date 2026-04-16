import { createError } from 'h3'
import { S3ServiceException } from '@aws-sdk/client-s3'
import { useS3Storage } from '../../services/s3Storage'

/**
 * Smoke check: reachability via SDK HeadObject on probe key.
 * 404 on a missing probe object usually means auth is valid.
 */
export default defineEventHandler(async (event) => {
  const storage = useS3Storage(event)
  const probeKey = '__nitro_health_probe__'
  try {
    await storage.headObject(probeKey)
    return {
      ok: true,
      bucket: storage.config.bucket,
      endpoint: storage.config.endpoint,
      authMode: 'sdk',
      probeStatus: 200,
      probeStatusText: 'OK',
    }
  } catch (error) {
    if (error instanceof S3ServiceException) {
      const status = error.$metadata?.httpStatusCode || 502
      const notFound = status === 404 || error.name === 'NotFound'
      return {
        ok: notFound,
        bucket: storage.config.bucket,
        endpoint: storage.config.endpoint,
        authMode: 'sdk',
        probeStatus: status,
        probeStatusText: notFound ? 'Not Found' : error.name || 'Error',
        hint: notFound ? undefined : error.message,
      }
    }
    throw createError({
      statusCode: 502,
      statusMessage: 'Storage health failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
