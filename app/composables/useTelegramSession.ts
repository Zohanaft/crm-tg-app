import { useState } from 'nuxt/app'
import type { ITelegramSession, IUserSession } from '~/types/telegram-session'

export const useSessionState = () => useState<ITelegramSession | Partial<ITelegramSession>>('telegram-session', () => ({}))

let fetchSessionPromise: Promise<void> | null = null

export function useUserSession(): IUserSession {
  fetchSession()
  const session = useSessionState()
  return { session, clearSession }
}

export const clearSession = async () => {
  fetchSessionPromise = null
  await $fetch('/api/telegram/session', { method: 'DELETE' })
  useSessionState().value = { loggedIn: false }
}

export const fetchSession = async () => {
  if (fetchSessionPromise) return fetchSessionPromise
  const sessionState = useSessionState()
  fetchSessionPromise = $fetch<ITelegramSession>('/api/telegram/session')
    .then((data) => {
      sessionState.value = data ?? {}
    })
    .finally(() => {
      fetchSessionPromise = null
    })
  return fetchSessionPromise
}
