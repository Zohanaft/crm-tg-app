import { useUserStore } from '~/stores/user'

async function performLogout(options?: { redirect?: boolean }) {
  const userStore = useUserStore()
  const botsStore = useBotsStore()
  const wsStore = useWorkspacesStore()
  userStore.clearUser()
  botsStore.clearBots()
  wsStore.clear()
  try {
    const { apiFetch, getApiUrl } = await import('~/composables/useApiFetch')
    await apiFetch(getApiUrl('/logout'), { method: 'POST', public: true })
  } catch {
    // Ignore - cookies may already be cleared
  }
  if (options?.redirect !== false) {
    const router = useRouter()
    await router.replace('/sign-in')
  }
}

export function useLogout() {
  return {
    logout: () => performLogout({ redirect: true }),
  }
}

export const clearSession = () => performLogout({ redirect: false })
export const logout = () => performLogout({ redirect: true })
