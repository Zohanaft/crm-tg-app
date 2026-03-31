import { storeToRefs } from 'pinia'

export default defineNuxtPlugin(() => {
  const userStore = useUserStore()
  const { loggedIn } = storeToRefs(userStore)
  const globalWorkspaceRef = ref<string | null>(null)

  // Keep one global WS connection while user is authenticated.
  useWorkspaceWss(globalWorkspaceRef, {
    global: true,
    enabled: loggedIn,
  })
})
