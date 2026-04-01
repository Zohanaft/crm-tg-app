import type { Ref } from 'vue'
import type { Client } from './useClientsApi'
import type { FeedAction } from './useActionsApi'

type ClientStartMessage = {
  type: 'client:start'
  payload: {
    ownerId: string
    workspaceIds: string[]
    client: Client
  }
}

type ActionCreatedMessage = {
  type: 'action:created'
  ts?: string
  payload?: {
    action?: FeedAction & { createdAt?: string }
  }
}

type MemberJoinedMessage = {
  type: 'workspace:member_joined'
  ts?: string
  payload?: Record<string, unknown>
}

export function useWorkspaceWss(
  workspaceId: Ref<string | null>,
  opts: {
    /** When true, connect to all workspaces for this user (no workspaceId query). Ignores workspaceId ref. */
    global?: boolean
    /** When false, socket URL is undefined (no connection). */
    enabled?: Ref<boolean>
    onClientStart?: (client: Client, workspaceIds: string[]) => void
    onActionCreated?: (action: FeedAction) => void
    onMemberJoined?: (payload: Record<string, unknown>) => void
  },
) {
  const { public: runtimePublic } = useRuntimeConfig()
  const actionsStore = useActionsStore()
  const enabled = opts.enabled

  const wssUrl = computed(() => {
    if (!import.meta.client) return undefined
    if (enabled && !enabled.value) return undefined
    const wssPath = runtimePublic.wssPath || '/api/wss'
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    if (opts.global) {
      return `${proto}//${host}${wssPath}`
    }
    if (!workspaceId.value) return undefined
    return `${proto}//${host}${wssPath}?workspaceId=${encodeURIComponent(workspaceId.value)}`
  })

  const ready = ref(false)

  const { status, ws } = useWebSocket(wssUrl, {
    autoConnect: true,
    autoClose: true,
    onMessage: (_ws, event) => {
      const text = typeof event.data === 'string' ? event.data : event.data?.toString?.() ?? ''
      if (!text) return

      let msg: ClientStartMessage | ActionCreatedMessage | MemberJoinedMessage | { type?: string }
      try {
        msg = JSON.parse(text) as typeof msg
      } catch {
        return
      }

      if (msg.type === 'wss:ready') {
        ready.value = true
        return
      }

      if (msg.type === 'client:start') {
        const m = msg as ClientStartMessage
        if (!m.payload?.client || !opts.onClientStart) return
        opts.onClientStart(m.payload.client, m.payload.workspaceIds ?? [])
        return
      }

      if (msg.type === 'action:created') {
        const m = msg as ActionCreatedMessage
        const raw = m.payload?.action
        if (!raw?.id) return
        const action: FeedAction = {
          id: String(raw.id),
          workspaceId: String(raw.workspaceId),
          type: String(raw.type),
          title: String(raw.title),
          meta: raw.meta ?? null,
          actorUserId: raw.actorUserId != null ? String(raw.actorUserId) : null,
          recipientUserId: raw.recipientUserId != null ? String(raw.recipientUserId) : null,
          readAt: raw.readAt == null ? null : String(raw.readAt),
          createdAt:
            typeof raw.createdAt === 'string'
              ? raw.createdAt
              : new Date(raw.createdAt as Date).toISOString(),
        }
        actionsStore.prependAction(action)
        opts.onActionCreated?.(action)
        return
      }

      if (msg.type === 'workspace:member_joined') {
        const m = msg as MemberJoinedMessage
        opts.onMemberJoined?.(m.payload ?? {})
        return
      }
    },
  })

  return { status, ws, ready }
}
