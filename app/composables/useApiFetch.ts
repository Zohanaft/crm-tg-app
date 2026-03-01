import type { NitroFetchRequest, NitroFetchOptions } from 'nitropack'
import { logout } from '~/composables/useLogout'

const REFRESH_URL = '/api/refresh'
const LOGIN_URL = '/api/login'
const LOGOUT_URL = '/api/logout'

export function useApiFetch<T = unknown>(
  request: NitroFetchRequest,
  options?: NitroFetchOptions<'json'>,
) {
  const opts = { ...options, credentials: 'include' as RequestCredentials }

  const doFetch = () =>
    $fetch<T>(request, opts)

  return doFetch().catch(async (err: { statusCode?: number; data?: { message?: string } }) => {
    if (err?.statusCode !== 401) throw err

    const requestStr =
      typeof request === 'string'
        ? request
        : request instanceof URL
          ? request.toString()
          : (request as Request).url ?? ''
    if (requestStr.includes(REFRESH_URL) || requestStr.includes(LOGIN_URL) || requestStr.includes(LOGOUT_URL)) {
      throw err
    }

    try {
      await $fetch(REFRESH_URL, {
        method: 'POST',
        credentials: 'include',
      })
      return $fetch<T>(request, opts)
    } catch (refreshErr: unknown) {
      const refreshStatus = (refreshErr as { statusCode?: number })?.statusCode
      if (refreshStatus === 401 || refreshStatus === 400) {
        await logout()
      }
      throw refreshErr
    }
  })
}
