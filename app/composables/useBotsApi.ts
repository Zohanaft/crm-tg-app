export interface TgBot {
  id: string
  botId: string
  firstName: string | null
  username: string | null
  isBot: boolean | null
  canJoinGroups: boolean | null
  canReadAllGroupMessages: boolean | null
  supportsInlineQueries: boolean | null
  rawData: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface BotsListResponse {
  items: TgBot[]
  total: number
}

export interface GetBotsParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function useBotsApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function createBot(token: string): Promise<Omit<TgBot, 'token'>> {
    return apiFetch<Omit<TgBot, 'token'>>(getApiUrl('/bots'), {
      method: 'POST',
      body: { token },
      headers,
    })
  }

  async function getBots(params?: GetBotsParams): Promise<BotsListResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page != null) searchParams.set('page', String(params.page))
    if (params?.limit != null) searchParams.set('limit', String(params.limit))
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder)
    const query = searchParams.toString()
    const url = query ? `${getApiUrl('/bots')}?${query}` : getApiUrl('/bots')
    return apiFetch<BotsListResponse>(url, { method: 'GET', headers })
  }

  async function updateBot(botId: string, body: Record<string, unknown>): Promise<TgBot> {
    return apiFetch<TgBot>(getApiUrl(`/bots/${encodeURIComponent(botId)}`), {
      method: 'PATCH',
      body,
      headers,
    })
  }

  async function deleteBot(botId: string): Promise<void> {
    await apiFetch(getApiUrl(`/bots/${encodeURIComponent(botId)}`), {
      method: 'DELETE',
      headers,
    })
  }

  return { createBot, getBots, updateBot, deleteBot }
}
