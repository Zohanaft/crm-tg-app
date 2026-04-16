export type YcStorageHealthResponse = {
  ok: boolean
  bucket: string
  endpoint: string
  authMode: string
  probeStatus: number
  probeStatusText: string
  hint?: string
}

export type YcStorageUploadResponse = {
  key: string
  signedUrl: string
  expiresIn: number
}

export type YcStorageGetResponse = {
  key: string
  signedUrl: string
  expiresIn: number
}

export function useYcStorageUpload() {
  async function checkHealth(): Promise<YcStorageHealthResponse> {
    return await $fetch<YcStorageHealthResponse>('/api/storage/health')
  }

  /**
   * Upload file via Nitro (secrets stay server-side).
   * Optional multipart field `prefix` (alphanumeric segments), default `uploads`.
   */
  async function upload(
    file: File,
    opts?: { prefix?: string },
  ): Promise<YcStorageUploadResponse> {
    const body = new FormData()
    body.append('file', file)
    if (opts?.prefix?.trim()) {
      body.append('prefix', opts.prefix.trim())
    }
    return await $fetch<YcStorageUploadResponse>('/api/storage/upload', {
      method: 'POST',
      body,
    })
  }

  async function getObjectUrl(key: string, opts?: { expiresIn?: number }): Promise<YcStorageGetResponse> {
    return await $fetch<YcStorageGetResponse>('/api/storage/get', {
      method: 'POST',
      body: {
        key,
        expiresIn: opts?.expiresIn,
      },
    })
  }

  async function removeObject(key: string): Promise<{ ok: true; key: string }> {
    return await $fetch<{ ok: true; key: string }>('/api/storage/delete', {
      method: 'POST',
      body: { key },
    })
  }

  return { checkHealth, upload, getObjectUrl, removeObject }
}
