import { defineStore } from 'pinia'
import type { TgBot } from '~/composables/useBotsApi'
import type { GetBotsParams } from '~/composables/useBotsApi'

export const useBotsStore = defineStore('bots', {
  state: () => ({
    items: [] as TgBot[],
    total: 0,
    pending: false,
    error: null as string | null,
  }),
  getters: {
    bots: (state) => state.items,
    isEmpty: (state) => state.items.length === 0,
  },
  actions: {
    async fetchBots(params?: GetBotsParams) {
      const { getBots } = useBotsApi()
      this.pending = true
      this.error = null
      try {
        const res = await getBots(params ?? { page: 1, limit: 20 })
        this.items = res.items
        this.total = res.total
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        this.pending = false
      }
    },
    async createBot(token: string) {
      const { createBot } = useBotsApi()
      const bot = await createBot(token)
      this.items = [bot, ...this.items]
      this.total += 1
      return bot
    },
    async updateBot(botId: string, body: Record<string, unknown>) {
      const { updateBot } = useBotsApi()
      const updated = await updateBot(botId, body)
      const idx = this.items.findIndex((b) => b.botId === botId)
      if (idx >= 0) {
        this.items = [...this.items]
        this.items[idx] = updated
      }
      return updated
    },
    async deleteBot(botId: string) {
      const { deleteBot } = useBotsApi()
      await deleteBot(botId)
      this.items = this.items.filter((b) => b.botId !== botId)
      this.total = Math.max(0, this.total - 1)
    },
    clearBots() {
      this.items = []
      this.total = 0
      this.error = null
    },
  },
})
