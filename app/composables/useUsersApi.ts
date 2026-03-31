export interface UserSearchItem {
  id: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
}

export function useUsersApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function search(workspaceId: string, q: string): Promise<UserSearchItem[]> {
    const qs = new URLSearchParams({ workspaceId, q })
    return apiFetch<UserSearchItem[]>(
      getApiUrl(`/users/search?${qs.toString()}`),
      { method: 'GET', headers },
    )
  }

  return { search }
}
