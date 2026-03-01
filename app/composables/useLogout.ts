import { useUserStore } from '~/stores/user'
import { apiFetch, getApiUrl } from '~/composables/useApiFetch'

async function performLogout(options?: { redirect?: boolean }) {
  const userStore = useUserStore()
  userStore.clearUser()
  try {
    await apiFetch(getApiUrl('/logout'), { method: 'POST', public: true })
  } catch {
    // Ignore - cookies may already be cleared
  }
  if (options?.redirect !== false) {
    const router = useRouter()
    await router.replace('/login')
  }
}

export function useLogout() {
  return {
    logout: () => performLogout({ redirect: true }),
  }
}

export const clearSession = () => performLogout({ redirect: false })
export const logout = () => performLogout({ redirect: true })
