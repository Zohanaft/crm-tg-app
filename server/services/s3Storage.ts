import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { H3Event } from 'h3'

const DEFAULT_GET_EXPIRES_SEC = 60 * 60

type StorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

function normalizeEndpoint(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw createError({
      statusCode: 503,
      message: 'Invalid S3_BUCKET_ENDPOINT. Expected full URL like https://s3.example.com',
    })
  }
  return parsed.toString().replace(/\/$/, '')
}

function readStorageConfig(config: ReturnType<typeof useRuntimeConfig>): StorageConfig {
  const endpoint = String(config.s3BucketEndpoint || '').trim()
  const region = String(config.s3BucketRegion || '').trim()
  const bucket = String(config.s3BucketName || '').trim()
  const accessKeyId = String(config.s3BucketAccessKeyId || '').trim()
  const secretAccessKey = String(config.s3BucketSecretAccessKey || '').trim()

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw createError({
      statusCode: 503,
      message:
        'S3 storage is not configured. Set S3_BUCKET_ENDPOINT, S3_BUCKET_REGION, S3_BUCKET_NAME, S3_BUCKET_PUBLIC, S3_BUCKET_SECRET.',
    })
  }

  return { endpoint: normalizeEndpoint(endpoint), region, bucket, accessKeyId, secretAccessKey }
}

function createS3Client(cfg: StorageConfig): S3Client {
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })

  // Log finalized HTTP request shape from AWS SDK middleware to verify
  // actual host/path/query sent to upstream S3-compatible provider.
  client.middlewareStack.add(
    (next, context) => async (args) => {
      const req = (args as {
        request?: {
          method?: string
          protocol?: string
          hostname?: string
          path?: string
          query?: Record<string, string>
        }
      }).request

      if (req?.hostname && req?.path && req?.method) {
        console.info('[s3:sdk-http] request', {
          command: context.commandName,
          method: req.method,
          url: `${req.protocol || 'https:'}//${req.hostname}${req.path}`,
          hostname: req.hostname,
          path: req.path,
          query: req.query || {},
        })
      }

      return await next(args)
    },
    {
      step: 'build',
      name: 'logS3FinalHttpRequest',
      tags: ['DEBUG'],
    },
  )

  return client
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[^\w.\-]+/g, '_').trim()
  return base.slice(0, 180) || 'file.bin'
}

export function sanitizePrefix(raw: string | undefined): string {
  if (!raw) return 'uploads'
  const s = raw.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '')
  return s.slice(0, 120) || 'uploads'
}

export function sanitizeObjectKey(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw createError({ statusCode: 400, message: 'Missing key' })
  }
  const key = raw.trim().replace(/^\/+/, '')
  if (!key || key.includes('..') || key.includes('//')) {
    throw createError({ statusCode: 400, message: 'Invalid key' })
  }
  return key
}

export function ensurePrefix(key: string, requiredPrefix: string): string {
  if (!key.startsWith(`${requiredPrefix}/`)) {
    throw createError({ statusCode: 403, message: 'Key not allowed for this operation' })
  }
  return key
}

export function resolveContentType(filename: string, fromPart: string | undefined): string {
  const raw = (fromPart || '').trim().toLowerCase()
  if (raw && raw !== 'application/octet-stream') {
    return fromPart!.trim()
  }
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return raw || 'application/octet-stream'
}

export function buildObjectKey(prefix: string, filename: string): string {
  return `${sanitizePrefix(prefix)}/${randomUUID()}-${sanitizeFilename(filename)}`
}

export function buildObjectUrl(endpoint: string, bucket: string, key: string): string {
  const endpointUrl = new URL(endpoint)
  const path = key
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const bucketHost = `${bucket}.${endpointUrl.host}`
  endpointUrl.host = bucketHost
  endpointUrl.pathname = `/${path}`
  return endpointUrl.toString()
}

export function mapS3Error(error: unknown, fallbackStatus = 502, fallbackMessage = 'S3 request failed') {
  if (error instanceof S3ServiceException) {
    const status = error.$metadata?.httpStatusCode || fallbackStatus
    console.error('[s3:error]', {
      fallbackMessage,
      name: error.name,
      message: error.message,
      status,
      requestId: error.$metadata?.requestId,
      extendedRequestId: error.$metadata?.extendedRequestId,
      cfId: error.$metadata?.cfId,
    })
    return createError({
      statusCode: status,
      statusMessage: fallbackMessage,
      message: error.message || fallbackMessage,
    })
  }
  const msg = error instanceof Error ? error.message : String(error)
  console.error('[s3:error]', {
    fallbackMessage,
    message: msg || fallbackMessage,
  })
  return createError({
    statusCode: fallbackStatus,
    statusMessage: fallbackMessage,
    message: msg || fallbackMessage,
  })
}

export function useS3Storage(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  const cfg = readStorageConfig(runtimeConfig)
  const client = createS3Client(cfg)

  async function uploadObject(params: { key: string; body: Uint8Array; contentType: string }) {
    const putUrl = buildObjectUrl(cfg.endpoint, cfg.bucket, params.key)
    console.info('[s3:put] request', {
      method: 'PUT',
      url: putUrl,
      bucket: cfg.bucket,
      key: params.key,
      region: cfg.region,
      contentType: params.contentType,
      sizeBytes: params.body.byteLength,
      accessKeyIdSuffix: cfg.accessKeyId.slice(-6),
    })
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    )
    console.info('[s3:put] success', {
      bucket: cfg.bucket,
      key: params.key,
      url: putUrl,
    })
    return { key: params.key, bucket: cfg.bucket, objectUrl: buildObjectUrl(cfg.endpoint, cfg.bucket, params.key) }
  }

  async function deleteObject(key: string) {
    await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
    return { ok: true as const, key }
  }

  async function getSignedGetUrl(key: string, expiresIn = DEFAULT_GET_EXPIRES_SEC) {
    const expires = Number.isFinite(expiresIn) ? Math.max(60, Math.min(24 * 60 * 60, expiresIn)) : DEFAULT_GET_EXPIRES_SEC
    const command = new GetObjectCommand({ Bucket: cfg.bucket, Key: key })
    const signedUrl = await getSignedUrl(client, command, { expiresIn: expires })
    return { key, signedUrl, expiresIn: expires }
  }

  async function headObject(key: string) {
    await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }))
  }

  return {
    config: cfg,
    uploadObject,
    deleteObject,
    getSignedGetUrl,
    headObject,
  }
}
