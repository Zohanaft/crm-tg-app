export interface FeedAction {
  id: string
  workspaceId: string
  type: string
  title: string
  meta: unknown | null
  actorUserId: string | null
  recipientUserId: string | null
  createdAt: string
}

export function useActionsApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function list(workspaceId?: string | null): Promise<FeedAction[]> {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
    return apiFetch<FeedAction[]>(getApiUrl(`/actions${qs}`), { method: 'GET', headers })
  }

  return { list }
}
