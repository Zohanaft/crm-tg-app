export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  if (!('serviceWorker' in navigator)) return

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      // Ask browser to check for an updated worker on each page load.
      void registration.update()

      // If a new worker takes control, reload once to sync manifest/chunks.
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        window.location.reload()
      })
    } catch (error) {
      console.warn('[sw] registration failed', error)
    }
  }

  if (document.readyState === 'complete') {
    void register()
    return
  }
  window.addEventListener('load', () => {
    void register()
  }, { once: true })
})
