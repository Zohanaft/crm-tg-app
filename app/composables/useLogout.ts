import { useUserStore } from '~/stores/user'

async function performLogout(options?: { redirect?: boolean }) {
  const userStore = useUserStore()
  userStore.clearUser()
  try {
    await $fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
    })
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
