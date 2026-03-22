export interface Workspace {
  id: string
  name: string
  ownerId: string
  ownerName: string | null
  createdAt: string
  updatedAt: string
}

export function useWorkspacesApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function listMy(): Promise<Workspace[]> {
    return apiFetch<Workspace[]>(getApiUrl('/workspace/me'), { method: 'GET', headers })
  }

  async function create(name: string): Promise<Workspace> {
    return apiFetch<Workspace>(getApiUrl('/workspace'), {
      method: 'POST',
      body: { name },
      headers,
    })
  }

  async function update(id: string, name: string): Promise<Workspace> {
    return apiFetch<Workspace>(getApiUrl(`/workspace/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      body: { name },
      headers,
    })
  }

  async function remove(id: string): Promise<void> {
    await apiFetch(getApiUrl(`/workspace/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers,
    })
  }

  return { listMy, create, update, remove }
}
