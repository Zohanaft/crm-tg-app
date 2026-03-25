import type { Ref } from 'vue'
import type { Client } from './useClientsApi'

type ClientStartMessage = {
  type: 'client:start'
  payload: {
    ownerId: string
    workspaceIds: string[]
    client: Client
  }
}

export function useWorkspaceWss(
  workspaceId: Ref<string | null>,
  opts: {
    onClientStart: (client: Client, workspaceIds: string[]) => void
  },
) {
  const { public: runtimePublic } = useRuntimeConfig()

  const wssUrl = computed(() => {
    if (!import.meta.client) return undefined
    if (!workspaceId.value) return undefined
    const wssPath = runtimePublic.wssPath || '/api/wss'
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${wssPath}?workspaceId=${encodeURIComponent(workspaceId.value)}`
  })

  const ready = ref(false)

  const { status, ws } = useWebSocket(wssUrl, {
    autoConnect: true,
    autoClose: true,
    onMessage: (_ws, event) => {
      const text = typeof event.data === 'string' ? event.data : event.data?.toString?.() ?? ''
      if (!text) return

      let msg: ClientStartMessage | { type?: string; payload?: unknown }
      try {
        msg = JSON.parse(text) as ClientStartMessage
      } catch {
        return
      }

      if ((msg as any).type === 'wss:ready') {
        ready.value = true
        return
      }

      if ((msg as any).type !== 'client:start') return
      const m = msg as ClientStartMessage
      if (!m.payload?.client) return
      opts.onClientStart(m.payload.client, m.payload.workspaceIds ?? [])
    },
  })

  return { status, ws, ready }
}

