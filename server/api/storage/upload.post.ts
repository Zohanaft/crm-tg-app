import { createError, readMultipartFormData } from 'h3'
import {
  buildObjectUrl,
  buildObjectKey,
  mapS3Error,
  resolveContentType,
  sanitizeFilename,
  sanitizePrefix,
  useS3Storage,
} from '../../services/s3Storage'

export default defineEventHandler(async (event) => {
  const storage = useS3Storage(event)
  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({
      statusCode: 400,
      message: 'Expected multipart/form-data with field "file"',
    })
  }

  const filePart = parts.find((p) => p.name === 'file' && p.data && p.data.length > 0)
  if (!filePart?.data) {
    throw createError({ statusCode: 400, message: 'Missing non-empty "file" field' })
  }

  const prefixField = parts.find((p) => p.name === 'prefix' && p.data)
  const prefix = sanitizePrefix(
    prefixField?.data ? Buffer.from(prefixField.data).toString('utf8') : undefined,
  )
  const filename = sanitizeFilename(filePart.filename || 'upload.bin')
  const key = buildObjectKey(prefix, filename)

  const contentType = resolveContentType(filename, filePart.type)
  const bytes = new Uint8Array(filePart.data)
  const putUrl = buildObjectUrl(storage.config.endpoint, storage.config.bucket, key)
  console.info('[api:storage/upload] prepared', {
    method: 'PUT',
    url: putUrl,
    bucket: storage.config.bucket,
    key,
    prefix,
    originalFilename: filePart.filename || 'upload.bin',
    contentType,
    sizeBytes: bytes.byteLength,
  })

  try {
    await storage.uploadObject({
      key,
      body: bytes,
      contentType,
    })
    const signed = await storage.getSignedGetUrl(key)
    console.info('[api:storage/upload] signed-get', {
      key,
      expiresIn: signed.expiresIn,
      signedUrl: signed.signedUrl,
    })
    return {
      key,
      signedUrl: signed.signedUrl,
      expiresIn: signed.expiresIn,
    }
  } catch (error) {
    throw mapS3Error(error, 502, 'Upstream PUT failed')
  }
})
