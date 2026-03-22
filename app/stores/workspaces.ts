import { defineStore } from 'pinia'
import type { Workspace } from '~/composables/useWorkspacesApi'

export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    items: [] as Workspace[],
    pending: false,
    error: null as string | null,
  }),
  getters: {
    workspaces: (s) => s.items,
    isEmpty: (s) => s.items.length === 0,
    byId: (s) => (id: string) => s.items.find((w) => w.id === id),
  },
  actions: {
    async fetchMy() {
      const { listMy } = useWorkspacesApi()
      this.pending = true
      this.error = null
      try {
        this.items = await listMy()
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        this.pending = false
      }
    },
    async create(name: string) {
      const { create } = useWorkspacesApi()
      const w = await create(name)
      this.items = [...this.items, w]
      return w
    },
    async updateName(id: string, name: string) {
      const { update } = useWorkspacesApi()
      const w = await update(id, name)
      const idx = this.items.findIndex((x) => x.id === id)
      if (idx >= 0) {
        this.items = [...this.items]
        this.items[idx] = w
      }
      return w
    },
    async deleteWorkspace(id: string) {
      const { remove } = useWorkspacesApi()
      try {
        await remove(id)
        this.items = this.items.filter((w) => w.id !== id)
      } catch (e) {
        try {
          await this.fetchMy()
        } catch {
          // ignore refetch errors
        }
        throw e
      }
    },
    clear() {
      this.items = []
      this.error = null
    },
  },
})
