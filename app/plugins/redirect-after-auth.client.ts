export default defineNuxtPlugin(() => {
  const redirecting = useCookie<string | null>('redirecting', { path: '/' })
  const path = redirecting.value
  if (path) {
    redirecting.value = null
    navigateTo(path)
  }
})
