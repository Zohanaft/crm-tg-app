import type { Ref } from 'vue'

/** Payload from Telegram Login Widget callback (data-onauth) */
export interface ITelegramAuthUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export interface ITelegramSession {
  loggedIn: boolean
  status: number
  id?: number
  message?: string
  first_name?: string
  username?: string
  photo_url?: string
  auth_date?: number
  hash?: string
}

export interface IUserSession {
  session: Ref<ITelegramSession | Partial<ITelegramSession>>
  clearSession: () => Promise<void>
}
