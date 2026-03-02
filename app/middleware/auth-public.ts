import type { IUser } from '~/stores/user'
import { apiFetch, getApiUrl, getRequestHeaders } from '~/composables/useApiFetch'

export default defineNuxtRouteMiddleware(async () => {
  const userStore = useUserStore()
  if (userStore.loggedIn) return

  const accessToken = useCookie('access_token', { path: '/' })
  const refreshToken = useCookie('refresh_token', { path: '/' })


  if (!accessToken.value || !refreshToken.value) return

  const headers = getRequestHeaders()
  let profile: IUser | null = null


  try {
    profile = await apiFetch<IUser>(getApiUrl('/profile'), { headers })
    if (profile) userStore.setUser(profile)
  } catch {
    profile = null
  }
})
