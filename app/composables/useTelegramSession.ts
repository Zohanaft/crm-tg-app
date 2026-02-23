import { useState } from 'nuxt/app'
import type { ITelegramSession, IUserSession } from '~/types/telegram-session'

export const useSessionState = () => useState<ITelegramSession | Partial<ITelegramSession>>('telegram-session', () => ({}))

export function useUserSession(): IUserSession {
  fetchSession()
  const session = useSessionState()
  return { session, clearSession }
}

export const clearSession = async () => {
  await $fetch('/api/telegram/session', { method: 'DELETE' })
  useSessionState().value = { loggedIn: false }
}

export const fetchSession = async () => {
  const sessionState = useSessionState()
  const data = await $fetch<ITelegramSession>('/api/telegram/session')
  sessionState.value = data ?? {}
}
