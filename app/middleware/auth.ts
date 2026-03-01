import type { IUser } from '~/stores/user'
import { apiFetch, getApiUrl, getRequestHeaders } from '~/composables/useApiFetch'

export default defineNuxtRouteMiddleware(async () => {
  const userStore = useUserStore()
  if (userStore.loggedIn) return

  const headers = getRequestHeaders()
  let profile: IUser | null = null

  try {
    profile = await apiFetch<IUser>(getApiUrl('/profile'), { headers })
    if (profile) userStore.setUser(profile)
  } catch {
    profile = null
  }

  if (!profile) {
    console.log('[auth middleware] no profile, clearing session and redirecting to /login')
    userStore.clearUser()
    try {
      await apiFetch(getApiUrl('/logout'), {
        method: 'POST',
        headers,
        public: true,
      })
    } catch {
      // cookies могут быть уже очищены
    }
    return navigateTo('/login')
  }
})
