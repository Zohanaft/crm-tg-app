import { storeToRefs } from 'pinia'

function applyMemberJoinedFromPayload(
  wsStore: ReturnType<typeof useWorkspacesStore>,
  payload: Record<string, unknown>,
) {
  const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : ''
  const memberRaw = payload.member as Record<string, unknown> | undefined
  if (!workspaceId || !memberRaw || typeof memberRaw.userId !== 'string') return
  wsStore.upsertMember(workspaceId, {
    userId: memberRaw.userId,
    username:
      memberRaw.username === null || memberRaw.username === undefined
        ? null
        : String(memberRaw.username),
    firstName:
      memberRaw.firstName === null || memberRaw.firstName === undefined
        ? null
        : String(memberRaw.firstName),
    lastName:
      memberRaw.lastName === null || memberRaw.lastName === undefined
        ? null
        : String(memberRaw.lastName),
    photoUrl:
      memberRaw.photoUrl === null || memberRaw.photoUrl === undefined
        ? null
        : String(memberRaw.photoUrl),
  })
}

function translateRemovedMemberTitle(nuxtApp: ReturnType<typeof useNuxtApp>): string {
  const withI18n = nuxtApp as typeof nuxtApp & {
    $i18n?: { t: (key: string) => string }
  }
  const fromModule = withI18n.$i18n?.t?.('dashboard.workspaceRemovedAsMember')
  if (typeof fromModule === 'string' && fromModule.trim()) return fromModule

  const gp = nuxtApp.vueApp.config.globalProperties as {
    $t?: (key: string) => string
  }
  const fromGp = gp.$t?.('dashboard.workspaceRemovedAsMember')
  if (typeof fromGp === 'string' && fromGp.trim()) return fromGp

  return 'You were removed from a workspace'
}

export default defineNuxtPlugin((nuxtApp) => {
  const userStore = useUserStore()
  const { loggedIn } = storeToRefs(userStore)
  const actionsStore = useActionsStore()
  const wsStore = useWorkspacesStore()
  const toast = useToast()
  let lastRemovedSelfToastKey = ''
  let lastRemovedSelfToastAt = 0
  const globalWorkspaceRef = ref<string | null>(null)
  const channelName = 'tg-crm-wss-sync-v1'
  const leaderKey = 'tg-crm-wss-leader-v1'
  const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const leaderHeartbeatMs = 2000
  const leaderTtlMs = 7000
  const isLeader = ref(false)

  const bc = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(channelName)
    : null

  type LeaderState = {
    tabId: string
    ts: number
  }

  function readLeaderState(): LeaderState | null {
    try {
      const raw = localStorage.getItem(leaderKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as LeaderState
      if (!parsed?.tabId || typeof parsed.ts !== 'number') return null
      return parsed
    } catch {
      return null
    }
  }

  function writeLeaderState(state: LeaderState) {
    localStorage.setItem(leaderKey, JSON.stringify(state))
  }

  function clearLeaderStateIfMine() {
    const current = readLeaderState()
    if (current?.tabId === tabId) {
      localStorage.removeItem(leaderKey)
    }
  }

  function electLeader() {
    if (!loggedIn.value) {
      isLeader.value = false
      clearLeaderStateIfMine()
      return
    }
    const current = readLeaderState()
    const now = Date.now()
    const expired = !current || now - current.ts > leaderTtlMs
    if (expired || current.tabId === tabId) {
      writeLeaderState({ tabId, ts: now })
      isLeader.value = true
      return
    }
    isLeader.value = false
  }

  const heartbeat = window.setInterval(() => {
    if (!loggedIn.value) return
    if (!isLeader.value) {
      electLeader()
      return
    }
    writeLeaderState({ tabId, ts: Date.now() })
  }, leaderHeartbeatMs)

  window.addEventListener('storage', (event) => {
    if (event.key !== leaderKey) return
    electLeader()
  })

  window.addEventListener('beforeunload', () => {
    clearInterval(heartbeat)
    clearLeaderStateIfMine()
    bc?.close()
  })

  watch(loggedIn, () => {
    electLeader()
  }, { immediate: true })

  const wsEnabled = computed(() => loggedIn.value && isLeader.value)

  // Keep one global WS connection while user is authenticated.
  useWorkspaceWss(globalWorkspaceRef, {
    global: true,
    enabled: wsEnabled,
    onActionCreated(action) {
      bc?.postMessage({
        type: 'action:created',
        action,
      })
    },
    onClientStart(client, workspaceIds) {
      bc?.postMessage({
        type: 'client:start',
        client,
        workspaceIds,
      })
    },
    onClientDeleted(clientId, workspaceIds) {
      actionsStore.removeNewClientActionsForClientId(clientId)
      bc?.postMessage({
        type: 'client:deleted',
        clientId,
        workspaceIds,
      })
    },
    onMemberJoined(payload: Record<string, unknown>) {
      applyMemberJoinedFromPayload(wsStore, payload)
      const workspaceId =
        typeof payload.workspaceId === 'string' ? payload.workspaceId : ''
      const member = payload.member as Record<string, unknown> | undefined
      if (workspaceId && member) {
        bc?.postMessage({
          type: 'workspace:member_joined',
          workspaceId,
          member,
        })
      }
    },
    onMemberRemoved({ workspaceId, removedUserId }) {
      bc?.postMessage({
        type: 'workspace:member_removed',
        workspaceId,
        removedUserId,
      })
    },
  })

  bc?.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as
      | { type: 'action:created'; action: unknown }
      | { type: 'client:start'; client: unknown; workspaceIds: unknown }
      | { type: 'client:deleted'; clientId?: unknown; workspaceIds?: unknown }
      | {
          type: 'workspace:member_joined'
          workspaceId?: unknown
          member?: Record<string, unknown>
        }
      | {
          type: 'workspace:member_removed'
          workspaceId?: unknown
          removedUserId?: unknown
        }
      | undefined
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'action:created') {
      const action = msg.action as Parameters<typeof actionsStore.prependAction>[0]
      if (action?.id) {
        actionsStore.prependAction(action)
      }
      return
    }
    if (msg.type === 'client:deleted') {
      const clientId = typeof msg.clientId === 'string' ? msg.clientId : ''
      if (clientId) {
        actionsStore.removeNewClientActionsForClientId(clientId)
      }
      return
    }
    if (msg.type === 'workspace:member_joined') {
      const workspaceId =
        typeof msg.workspaceId === 'string' ? msg.workspaceId : ''
      if (!workspaceId || !msg.member) return
      applyMemberJoinedFromPayload(wsStore, {
        workspaceId,
        member: msg.member,
      })
      return
    }
    if (msg.type === 'workspace:member_removed') {
      const workspaceId =
        typeof msg.workspaceId === 'string' ? msg.workspaceId : ''
      const removedUserId =
        typeof msg.removedUserId === 'string' ? msg.removedUserId : ''
      if (!workspaceId || !removedUserId) return
      void (async () => {
        const { wasSelf } = await wsStore.handleMemberRemovedEvent(
          workspaceId,
          removedUserId,
          userStore.user?.id,
        )
        if (wasSelf) {
          const dedupKey = `${workspaceId}:${removedUserId}`
          const now = Date.now()
          if (
            dedupKey !== lastRemovedSelfToastKey
            || now - lastRemovedSelfToastAt > 2500
          ) {
            lastRemovedSelfToastKey = dedupKey
            lastRemovedSelfToastAt = now
            toast.add({
              title: translateRemovedMemberTitle(nuxtApp),
              color: 'warning',
            })
          }
        }
      })()
    }
  })
})
