export interface WorkspaceInvitePending {
  id: string
  workspaceId: string
  invitedByUserId: string
  createdAt: string
  workspace: { id: string; name: string; ownerId: string }
  invitedBy: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
  }
}

export function useWorkspaceInvitesApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function listPending(): Promise<WorkspaceInvitePending[]> {
    return apiFetch(getApiUrl('/workspace/invites/me'), { method: 'GET', headers })
  }

  async function create(workspaceId: string, invitedUserId: string): Promise<{ id: string }> {
    return apiFetch(getApiUrl(`/workspace/${encodeURIComponent(workspaceId)}/invites`), {
      method: 'POST',
      body: { invitedUserId },
      headers,
    })
  }

  async function accept(inviteId: string): Promise<{ ok: true; workspaceId: string }> {
    return apiFetch(
      getApiUrl(`/workspace/invites/${encodeURIComponent(inviteId)}/accept`),
      { method: 'POST', headers },
    )
  }

  return { listPending, create, accept }
}
