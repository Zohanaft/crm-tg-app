import type { IUser } from '~/stores/user'
import { apiFetch, getApiUrl, getRequestHeaders } from '~/composables/useApiFetch'

export default defineNuxtRouteMiddleware(async (to) => {
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

    const redirecting = useCookie('redirecting', { path: '/', maxAge: 60 * 10 })
    redirecting.value = to.fullPath

    return navigateTo('/sign-in')
  }
})
