import { storeToRefs } from 'pinia'

export default defineNuxtPlugin(() => {
  const userStore = useUserStore()
  const { loggedIn } = storeToRefs(userStore)
  const actionsStore = useActionsStore()
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
      bc?.postMessage({
        type: 'client:deleted',
        clientId,
        workspaceIds,
      })
    },
  })

  bc?.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as
      | { type: 'action:created'; action: unknown }
      | { type: 'client:start'; client: unknown; workspaceIds: unknown }
      | { type: 'client:deleted'; clientId: unknown; workspaceIds: unknown }
      | undefined
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'action:created') {
      const action = msg.action as Parameters<typeof actionsStore.prependAction>[0]
      if (action?.id) {
        actionsStore.prependAction(action)
      }
    }
  })
})
