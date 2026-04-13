import type { ActionsListOpts, FeedAction } from '~/composables/useActionsApi'

function actionKey(a: FeedAction): string {
  return `${a.id}`
}

/** Human-readable labels for feed action types (RU default; can tie to i18n later) */
export function formatActionTypeLabel(type: string): string {
  switch (type) {
    case 'NEW_CLIENT':
      return 'Новый клиент'
    case 'WORKSPACE_MEMBER_JOINED':
      return 'Новый участник'
    case 'WORKSPACE_INVITE':
      return 'Приглашение'
    default:
      return type
  }
}

export const useActionsStore = defineStore('actions', {
  state: () => ({
    items: [] as FeedAction[],
    pending: false,
    error: null as string | null,
  }),
  getters: {
    unreadCount(state): number {
      return state.items.filter((a) => !a.readAt).length
    },
  },
  actions: {
    getNewClientDedupKey(action: FeedAction): string | null {
      if (action.type !== 'NEW_CLIENT') return null
      const m = action.meta as
        | { client?: { telegramId?: string | null; id?: string | null } }
        | null
        | undefined
      const tg = m?.client?.telegramId
      const id = m?.client?.id
      if (typeof tg === 'string' && tg.trim()) return `tg:${tg}`
      if (typeof id === 'string' && id.trim()) return `id:${id}`
      return null
    },

    dedupeActions(list: FeedAction[]): FeedAction[] {
      const seenIds = new Set<string>()
      const seenNewClients = new Set<string>()
      const result: FeedAction[] = []
      for (const a of list) {
        if (seenIds.has(a.id)) continue
        seenIds.add(a.id)
        const dedupKey = this.getNewClientDedupKey(a)
        if (dedupKey) {
          if (seenNewClients.has(dedupKey)) continue
          seenNewClients.add(dedupKey)
        }
        result.push(a)
      }
      return result
    },

    clear() {
      this.items = []
      this.error = null
    },

    prependAction(action: FeedAction) {
      const dedupKey = this.getNewClientDedupKey(action)
      if (dedupKey) {
        const existsNewClient = this.items.some((x) => this.getNewClientDedupKey(x) === dedupKey)
        if (existsNewClient) return
      }
      const k = actionKey(action)
      if (this.items.some((x) => actionKey(x) === k)) return
      this.items = [action, ...this.items].slice(0, 100)
    },

    /** Drop stale NEW_CLIENT rows so a later WSS action:created is not skipped by prependAction dedup. */
    removeNewClientActionsForClientId(clientId: string) {
      if (!clientId) return
      this.items = this.items.filter((a) => {
        if (a.type !== 'NEW_CLIENT') return true
        const m = a.meta as { client?: { id?: string | null } } | null | undefined
        const id = m?.client?.id
        return id !== clientId
      })
    },

    /** Без опций — личная лента; передайте workspaceIds для истории workspace */
    async fetchAll(opts?: ActionsListOpts) {
      const { list } = useActionsApi()
      this.pending = true
      this.error = null
      try {
        this.items = this.dedupeActions(await list(opts))
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
      } finally {
        this.pending = false
      }
    },

    handleWssActionCreated(raw: Record<string, unknown>) {
      const action = raw?.action as FeedAction | undefined
      if (!action?.id) return
      const normalized: FeedAction = {
        ...action,
        createdAt:
          typeof action.createdAt === 'string'
            ? action.createdAt
            : new Date(action.createdAt as unknown as Date).toISOString(),
      }
      this.prependAction(normalized)
    },

    async markRead(actionId: string) {
      const idx = this.items.findIndex((x) => x.id === actionId)
      if (idx === -1) return
      if (this.items[idx]?.readAt) return
      const now = new Date().toISOString()
      const optimistic = [...this.items]
      optimistic[idx] = { ...optimistic[idx], readAt: now }
      this.items = optimistic
      try {
        const { markRead } = useActionsApi()
        const updated = await markRead(actionId)
        const currentIdx = this.items.findIndex((x) => x.id === actionId)
        if (currentIdx >= 0) {
          const clone = [...this.items]
          clone[currentIdx] = { ...clone[currentIdx], readAt: updated.readAt ?? now }
          this.items = clone
        }
      } catch {
        const rollbackIdx = this.items.findIndex((x) => x.id === actionId)
        if (rollbackIdx >= 0) {
          const rollback = [...this.items]
          rollback[rollbackIdx] = { ...rollback[rollbackIdx], readAt: null }
          this.items = rollback
        }
      }
    },
  },
})
