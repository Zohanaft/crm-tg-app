declare global {
  interface Window {
    __telegramAuthHandler?: (user: unknown) => void
  }
}

export default defineNuxtPlugin(() => {
  ;(window as unknown as { onTelegramAuth?: (user: unknown) => void }).onTelegramAuth = (user: unknown) => {
    window.__telegramAuthHandler?.(user)
  }
})
