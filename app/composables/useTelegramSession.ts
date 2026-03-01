import type { IUser } from '~/stores/user'
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'
import { logout } from '~/composables/useLogout'

export function useUserSession() {
  const userStore = useUserStore()
  const { user } = storeToRefs(userStore)
  return {
    user: user as import('vue').Ref<IUser | null>,
    logout,
  }
}

