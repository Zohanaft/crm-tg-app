import type { FeedAction } from '~/composables/useActionsApi'

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
    lastReadAt: null as string | null,
  }),
  getters: {
    unreadCount(state): number {
      const threshold = state.lastReadAt ? new Date(state.lastReadAt).getTime() : 0
      return state.items.filter((a) => new Date(a.createdAt).getTime() > threshold).length
    },
  },
  actions: {
    markAllRead() {
      this.lastReadAt = new Date().toISOString()
    },

    clear() {
      this.items = []
      this.error = null
    },

    prependAction(action: FeedAction) {
      const k = actionKey(action)
      if (this.items.some((x) => actionKey(x) === k)) return
      this.items = [action, ...this.items].slice(0, 100)
    },

    async fetchAll() {
      const { list } = useActionsApi()
      this.pending = true
      this.error = null
      try {
        this.items = await list()
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
  },
})
