export interface Client {
  id: string
  telegramId: string
  isBot: boolean
  firstName: string
  lastName: string | null
  username: string | null
  chatId: string | null
  chatType: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export function useClientsApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function listForWorkspace(workspaceId: string): Promise<Client[]> {
    const url = `${getApiUrl('/clients')}?workspaceId=${encodeURIComponent(workspaceId)}`
    return apiFetch<Client[]>(url, { method: 'GET', headers })
  }

  async function removeForWorkspace(workspaceId: string, clientId: string): Promise<void> {
    const url = `${getApiUrl(`/clients/${encodeURIComponent(clientId)}`)}?workspaceId=${encodeURIComponent(workspaceId)}`
    await apiFetch(url, { method: 'DELETE', headers })
  }

  return { listForWorkspace, removeForWorkspace }
}

