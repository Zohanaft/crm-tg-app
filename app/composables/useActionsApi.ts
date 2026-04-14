export interface FeedAction {
  id: string
  workspaceId: string
  type: string
  title: string
  meta: unknown | null
  actorUserId: string | null
  recipientUserId: string | null
  readAt?: string | null
  createdAt: string
}

/** Без полей — личная лента; workspaceIds — режим истории workspace на бэкенде */
export type ActionsListOpts = {
  workspaceIds?: string[] | null
}

export function useActionsApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  function buildActionsQuery(opts?: ActionsListOpts): string {
    const params = new URLSearchParams()
    for (const raw of opts?.workspaceIds ?? []) {
      const id = raw?.trim()
      if (id) params.append('workspaceIds', id)
    }
    const s = params.toString()
    return s ? `?${s}` : ''
  }

  async function list(opts?: ActionsListOpts): Promise<FeedAction[]> {
    const qs = buildActionsQuery(opts)
    return apiFetch<FeedAction[]>(getApiUrl(`/actions${qs}`), { method: 'GET', headers })
  }

  async function markRead(actionId: string): Promise<FeedAction> {
    return apiFetch<FeedAction>(
      getApiUrl(`/actions/${encodeURIComponent(actionId)}/read`),
      { method: 'POST', headers },
    )
  }

  return { list, markRead }
}
