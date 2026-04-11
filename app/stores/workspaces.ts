import { defineStore } from 'pinia'
import type { Workspace, WorkspaceMember } from '~/composables/useWorkspacesApi'

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
        const list = await listMy()
        this.items = list.map((w) => {
          const prev = this.items.find((x) => x.id === w.id)
          return { ...w, members: prev?.members }
        })
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
    setMembers(workspaceId: string, members: WorkspaceMember[]) {
      const idx = this.items.findIndex((w) => w.id === workspaceId)
      if (idx < 0) return
      const row = this.items[idx]
      if (!row) return
      const next = [...this.items]
      next[idx] = { ...row, members: [...members] }
      this.items = next
    },
    upsertMember(
      workspaceId: string,
      partial: {
        userId: string
        username?: string | null
        firstName?: string | null
        lastName?: string | null
        photoUrl?: string | null
        id?: string
      },
    ) {
      const idx = this.items.findIndex((w) => w.id === workspaceId)
      if (idx < 0) return
      const w = this.items[idx]
      if (!w) return
      const existing = w.members ?? []
      const at = existing.findIndex((m) => m.userId === partial.userId)
      const merged: WorkspaceMember = {
        id:
          partial.id
          ?? (at >= 0 ? existing[at]!.id : `wss:${partial.userId}`),
        userId: partial.userId,
        username: partial.username ?? (at >= 0 ? existing[at]!.username : null),
        firstName: partial.firstName ?? (at >= 0 ? existing[at]!.firstName : null),
        lastName: partial.lastName ?? (at >= 0 ? existing[at]!.lastName : null),
        photoUrl: partial.photoUrl ?? (at >= 0 ? existing[at]!.photoUrl : null),
      }
      const members =
        at >= 0
          ? existing.map((m, i) => (i === at ? merged : m))
          : [...existing, merged]
      const next = [...this.items]
      next[idx] = { ...w, members }
      this.items = next
    },
    async fetchMembers(workspaceId: string) {
      const { listMembers } = useWorkspacesApi()
      try {
        const members = await listMembers(workspaceId)
        this.setMembers(workspaceId, members)
      } catch {
        this.setMembers(workspaceId, [])
      }
    },
    removeMemberFromWorkspace(workspaceId: string, userId: string) {
      const idx = this.items.findIndex((w) => w.id === workspaceId)
      if (idx < 0) return
      const w = this.items[idx]
      if (!w?.members?.length) return
      const members = w.members.filter((m) => m.userId !== userId)
      const next = [...this.items]
      next[idx] = { ...w, members }
      this.items = next
    },
    async handleMemberRemovedEvent(
      workspaceId: string,
      removedUserId: string,
      currentUserId: string | undefined,
    ): Promise<{ wasSelf: boolean }> {
      const wasSelf =
        Boolean(currentUserId) && removedUserId === currentUserId
      this.removeMemberFromWorkspace(workspaceId, removedUserId)
      if (wasSelf) {
        await this.fetchMy().catch(() => {})
      }
      return { wasSelf }
    },
    async removeMemberViaApi(workspaceId: string, targetUserId: string) {
      const { removeMember } = useWorkspacesApi()
      await removeMember(workspaceId, targetUserId)
      this.removeMemberFromWorkspace(workspaceId, targetUserId)
    },
    async updateName(id: string, name: string) {
      const { update } = useWorkspacesApi()
      const w = await update(id, name)
      const idx = this.items.findIndex((x) => x.id === id)
      if (idx >= 0) {
        const prevMembers = this.items[idx]?.members
        this.items = [...this.items]
        this.items[idx] = { ...w, members: prevMembers }
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
