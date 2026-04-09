export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  if (!('serviceWorker' in navigator)) return

  const { public: pub } = useRuntimeConfig()

  const unregisterAll = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(
          keys
            .filter((k) => k.startsWith('tg-crm-sw-'))
            .map((k) => caches.delete(k)),
        )
      }
    } catch (e) {
      console.warn('[sw] unregister failed', e)
    }
  }

  if (!pub.serviceWorkerEnabled) {
    void unregisterAll()
    return
  }

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      void registration.update()

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
