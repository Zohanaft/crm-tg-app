import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'
import { logout } from '~/composables/useLogout'

const REFRESH_PATH = '/refresh'
const LOGIN_PATH = '/login'
const LOGOUT_PATH = '/logout'

/** URL для API: на сервере — apiBase + apiPathPrefix + path, в браузере — /api + path */
export function getApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (import.meta.server) {
    const config = useRuntimeConfig()
    const base = (config.apiBase as string)?.trim()
    const prefix = (config.apiPathPrefix as string)?.trim() || ''
    if (base) return `${base.replace(/\/$/, '')}${prefix}${p}`
  }
  return `/api${p}`
}

/** Cookie из входящего запроса для SSR (передавать в options.headers в middleware) */
export function getRequestHeaders(): Record<string, string> | undefined {
  if (!import.meta.server) return undefined
  const event = useRequestEvent()
  const cookie = event?.node?.req?.headers?.cookie
  if (!cookie) return undefined
  const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : cookie
  return { Cookie: cookieStr }
}

/** Код ответа из ошибки — ofetch/Nitro могут класть в status, statusCode, response.status, data.statusCode, cause */
function getStatus(err: unknown): number | undefined {
  const e = err as {
    status?: number
    statusCode?: number
    response?: { status?: number }
    data?: { statusCode?: number }
    cause?: unknown
  }
  const s = e?.status ?? e?.statusCode ?? e?.response?.status ?? e?.data?.statusCode
  if (s != null) return s
  if (e?.cause && typeof e.cause === 'object') return getStatus(e.cause)
  return undefined
}

function isPublicPath(url: string): boolean {
  const u = typeof url === 'string' ? url : ''
  return [REFRESH_PATH, LOGIN_PATH, LOGOUT_PATH].some((p) => u.includes(p))
}

function resolveRequest(request: NitroFetchRequest): NitroFetchRequest {
  if (typeof request !== 'string') return request
  if (request.startsWith('http://') || request.startsWith('https://')) return request
  const path = request.startsWith('/api') ? request.slice(4) || '/' : request.startsWith('/') ? request : `/${request}`
  return getApiUrl(path) as NitroFetchRequest
}

export interface ApiFetchOptions<T = unknown> extends NitroFetchOptions<'json'> {
  /** Публичный запрос — при 401 не делаем refresh, сразу reject */
  public?: boolean
  /** Заголовки (для SSR передавать getRequestHeaders()) */
  headers?: Record<string, string>
  /** Вызов после успешного ответа (можно сделать redirect и т.д.) */
  onSuccess?: (data: T) => void | Promise<void>
}

/**
 * Обёртка над $fetch с перехватом 401:
 * - Приватный запрос: при 401 — запрос refresh, при успехе — повтор исходного запроса, затем onSuccess и resolve.
 * - При 401 на refresh — toast «Сессия завершена», logout, reject.
 * - Публичный запрос: при 401 просто reject.
 */
export async function apiFetch<T = unknown>(
  request: NitroFetchRequest,
  options: ApiFetchOptions<T> = {},
): Promise<T> {
  const { public: isPublic = false, headers, onSuccess, ...fetchOptions } = options
  const url = resolveRequest(request)
  const refreshUrl = getApiUrl(REFRESH_PATH) // resolve early — getApiUrl loses Nuxt context inside catch
  const opts = {
    credentials: 'include' as RequestCredentials,
    ...fetchOptions,
    ...(headers && { headers }),
  }

  const urlStr = typeof url === 'string' ? url : ''
  const isProfile = urlStr.includes('/profile')

  const doFetch = () => $fetch<T>(url, opts)

  const handleRefreshFailure = async () => {
    if (import.meta.client) {
      const toast = useToast()
      toast.add({
        title: 'Сессия завершена',
        description: 'Войдите снова',
        color: 'warning',
      })
      await logout()
    }
  }

  try {
    const data = await doFetch()
    if (onSuccess) await onSuccess(data)
    return data
  } catch (err: unknown) {
    const status = getStatus(err)
    if (status !== 401) {
      throw err
    }

    if (isPublic || isPublicPath(urlStr)) {
      throw err
    }

    let retryHeaders = headers
    try {
      const refreshRes = await $fetch<{ ok?: boolean; accessToken?: string; refreshToken?: string }>(refreshUrl, {
        method: 'POST',
        credentials: 'include',
        ...(headers && { headers }),
      })
      // On SSR, Set-Cookie from response isn't persisted — use tokens from body for retry
      if (import.meta.server && refreshRes?.accessToken && refreshRes?.refreshToken) {
        retryHeaders = {
          ...headers,
          Cookie: `access_token=${refreshRes.accessToken}; refresh_token=${refreshRes.refreshToken}`,
        }
      }
    } catch (refreshErr: unknown) {
      const refreshStatus = getStatus(refreshErr)
      if (refreshStatus === 401 || refreshStatus === 400) {
        await handleRefreshFailure()
      } 
      throw refreshErr
    }

    const retryOpts = retryHeaders ? { ...opts, headers: retryHeaders } : opts
    const retryData = await $fetch<T>(url, retryOpts)
    if (onSuccess) await onSuccess(retryData)
    return retryData
  }
}

export function useApiFetch() {
  return { apiFetch, getApiUrl, getRequestHeaders }
}
