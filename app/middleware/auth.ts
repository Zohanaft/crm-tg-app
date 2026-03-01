import type { IUser } from '~/stores/user'

export default defineNuxtRouteMiddleware(async () => {
  const userStore = useUserStore()
  if (userStore.loggedIn) return
  try {
    const profile = await useApiFetch<IUser>('/api/profile')
    if (profile) {
      userStore.setUser(profile)
      return
    }
  } catch {
    // useApiFetch уже вызвал clearSession и navigateTo('/login') при 401 после refresh
  }
  return navigateTo('/login')
})
