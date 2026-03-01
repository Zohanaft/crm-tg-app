import { defineStore } from 'pinia'

export interface IUser {
  id: string
  telegramId: string
  firstName: string | null
  lastName: string | null
  username: string | null
  photoUrl: string | null
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as IUser | null,
  }),
  getters: {
    loggedIn: (state) => state.user !== null,
  },
  actions: {
    setUser(user: IUser) {
      this.user = user
    },
    clearUser() {
      this.user = null
    },
  },
})
