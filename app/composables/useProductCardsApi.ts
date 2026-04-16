export type ProductCardPreviewImage = {
  key: string
  url: string
  originalName: string
}

export type ProductCard = {
  id: string
  title: string
  description: string
  workspaceOwnerId: string
  workspaceIds: string[]
  previewImages: ProductCardPreviewImage[]
  createdAt: string
  updatedAt: string
}

export type UpsertProductCardPayload = {
  title: string
  description: string
  workspaceIds: string[]
  previewImages: ProductCardPreviewImage[]
}

export function useProductCardsApi() {
  const { apiFetch, getApiUrl, getRequestHeaders } = useApiFetch()
  const headers = import.meta.server ? getRequestHeaders() : undefined

  async function listForWorkspace(workspaceId: string): Promise<ProductCard[]> {
    const url = `${getApiUrl('/product-cards')}?workspaceId=${encodeURIComponent(workspaceId)}`
    return apiFetch<ProductCard[]>(url, { method: 'GET', headers })
  }

  async function getOne(id: string, workspaceId: string): Promise<ProductCard> {
    const url = `${getApiUrl(`/product-cards/${encodeURIComponent(id)}`)}?workspaceId=${encodeURIComponent(workspaceId)}`
    return apiFetch<ProductCard>(url, { method: 'GET', headers })
  }

  async function create(payload: UpsertProductCardPayload): Promise<ProductCard> {
    return apiFetch<ProductCard>(getApiUrl('/product-cards'), {
      method: 'POST',
      body: payload,
      headers,
    })
  }

  async function update(id: string, payload: UpsertProductCardPayload): Promise<ProductCard> {
    return apiFetch<ProductCard>(getApiUrl(`/product-cards/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      body: payload,
      headers,
    })
  }

  async function remove(id: string, workspaceId: string): Promise<void> {
    const url = `${getApiUrl(`/product-cards/${encodeURIComponent(id)}`)}?workspaceId=${encodeURIComponent(workspaceId)}`
    await apiFetch(url, { method: 'DELETE', headers })
  }

  return {
    listForWorkspace,
    getOne,
    create,
    update,
    remove,
  }
}
