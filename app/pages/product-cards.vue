<script setup lang="ts">
import { useProductCardsApi } from '~/composables/useProductCardsApi'
import type { ProductCard, ProductCardPreviewImage, UpsertProductCardPayload } from '~/composables/useProductCardsApi'

definePageMeta({ middleware: 'auth-private' })

const { t } = useI18n()
const wsStore = useWorkspacesStore()
const userStore = useUserStore()
const { upload, removeObject } = useYcStorageUpload()
const { listForWorkspace, create, update, remove } = useProductCardsApi()

const MAX_PREVIEWS = 6
const MAX_BYTES = 2 * 1024 * 1024
const UPLOAD_PREFIX = 'product-cards'
const ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'

type PreviewItem = { id: string; objectUrl: string | null; key?: string; originalName?: string; pending: boolean }
type DraftCard = {
  title: string
  description: string
  workspaceIds: string[]
  previews: PreviewItem[]
  feedbackError: string | null
  submitting: boolean
}

const cards = ref<ProductCard[]>([])
const cardsPending = ref(false)
const cardsError = ref<string | null>(null)
const selectedWorkspaceId = ref<string | null>(null)

const modalOpen = ref(false)
const modalCommitted = ref(false)
const editingCardId = ref<string | null>(null)
const draft = ref<DraftCard | null>(null)
const sessionUploadedKeys = ref<string[]>([])

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput')
const dragDepth = ref(0)
const isDropzoneActive = computed(() => dragDepth.value > 0)
const hasPendingUploads = computed(() => Boolean(draft.value?.previews.some((p) => p.pending)))

const ownerWorkspaces = computed(() => wsStore.workspaces.filter((w) => w.ownerId === userStore.user?.id))
const modalTitle = computed(() => editingCardId.value ? t('productCards.modalTitleEdit') : t('productCards.modalTitleCreate'))

await useAsyncData('product-cards-init', async () => {
  await wsStore.fetchMy().catch(() => {})
  return true
})

watch(ownerWorkspaces, (items) => {
  if (!items.length) {
    selectedWorkspaceId.value = null
    cards.value = []
    return
  }
  if (!selectedWorkspaceId.value || !items.some((x) => x.id === selectedWorkspaceId.value)) {
    selectedWorkspaceId.value = items[0]?.id ?? null
  }
}, { immediate: true, deep: true })

watch(selectedWorkspaceId, async (workspaceId) => {
  if (!workspaceId) {
    cards.value = []
    cardsError.value = null
    return
  }
  await reloadCards(workspaceId)
}, { immediate: true })

let uploadChain = Promise.resolve()
function enqueueUpload(file: File) {
  const run = uploadChain.then(() => upload(file, { prefix: UPLOAD_PREFIX }))
  uploadChain = run.then(() => {}).catch(() => {})
  return run
}

function uploadErrorMessage(error: unknown): string {
  const e = error as { data?: { message?: string; statusMessage?: string }; message?: string; statusMessage?: string }
  const fromData = typeof e?.data?.message === 'string' ? e.data.message : typeof e?.data?.statusMessage === 'string' ? e.data.statusMessage : ''
  const plain = typeof e?.message === 'string' && e.message !== '[object Object]' ? e.message : typeof e?.statusMessage === 'string' ? e.statusMessage : ''
  return (fromData || plain).trim()
}

function validateImage(file: File): string | null {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') return t('productCards.invalidType')
  if (file.size > MAX_BYTES) return t('productCards.fileTooLarge')
  return null
}

function newDraft(): DraftCard {
  return {
    title: '',
    description: '',
    workspaceIds: selectedWorkspaceId.value ? [selectedWorkspaceId.value] : [],
    previews: [],
    feedbackError: null,
    submitting: false,
  }
}

function toPreview(image: ProductCardPreviewImage): PreviewItem {
  return { id: image.key, objectUrl: image.url, key: image.key, originalName: image.originalName, pending: false }
}

async function discardSessionUploads() {
  for (const key of [...sessionUploadedKeys.value]) await removeObject(key).catch(() => {})
  sessionUploadedKeys.value = []
}

watch(modalOpen, async (open) => {
  if (!open) {
    if (!modalCommitted.value) await discardSessionUploads()
    draft.value = null
    editingCardId.value = null
    sessionUploadedKeys.value = []
    modalCommitted.value = false
    dragDepth.value = 0
  }
})

function openCreateModal() {
  editingCardId.value = null
  draft.value = newDraft()
  modalOpen.value = true
}

function openEditModal(card: ProductCard) {
  editingCardId.value = card.id
  draft.value = { title: card.title, description: card.description, workspaceIds: [...card.workspaceIds], previews: card.previewImages.map(toPreview), feedbackError: null, submitting: false }
  modalOpen.value = true
}

function toggleWorkspace(workspaceId: string, checked: boolean) {
  if (!draft.value) return
  draft.value.workspaceIds = checked
    ? [...new Set([...draft.value.workspaceIds, workspaceId])]
    : draft.value.workspaceIds.filter((id) => id !== workspaceId)
}

async function handleFilesForDraft(files: FileList | File[]) {
  const card = draft.value
  if (!card) return
  card.feedbackError = null
  for (const file of Array.from(files)) {
    if (card.previews.length >= MAX_PREVIEWS) { card.feedbackError = t('productCards.maxImages'); break }
    const validation = validateImage(file)
    if (validation) { card.feedbackError = validation; continue }
    const previewId = crypto.randomUUID()
    card.previews.push({ id: previewId, objectUrl: null, originalName: file.name, pending: true })
    try {
      const uploaded = await enqueueUpload(file)
      const idx = card.previews.findIndex((p) => p.id === previewId)
      if (idx !== -1) {
        const next = [...card.previews]
        next[idx] = { id: previewId, objectUrl: uploaded.signedUrl, key: uploaded.key, originalName: file.name, pending: false }
        card.previews = next
      }
      sessionUploadedKeys.value = [...sessionUploadedKeys.value, uploaded.key]
    } catch (error) {
      card.previews = card.previews.filter((p) => p.id !== previewId)
      card.feedbackError = uploadErrorMessage(error) || t('productCards.uploadFailed')
    }
  }
}

function buildPayload(card: DraftCard): UpsertProductCardPayload {
  return {
    title: card.title.trim(),
    description: card.description.trim(),
    workspaceIds: [...new Set(card.workspaceIds.map((x) => x.trim()).filter(Boolean))],
    previewImages: card.previews.filter((p) => !p.pending && p.key && p.objectUrl).map((p) => ({
      key: p.key as string,
      url: p.objectUrl as string,
      originalName: p.originalName || p.key || 'image',
    })),
  }
}

async function reloadCards(workspaceId: string) {
  cardsPending.value = true
  cardsError.value = null
  try { cards.value = await listForWorkspace(workspaceId) }
  catch (error) { cardsError.value = uploadErrorMessage(error) || t('productCards.saveFailed') }
  finally { cardsPending.value = false }
}

async function saveDraft() {
  const card = draft.value
  if (!card || card.submitting) return
  card.feedbackError = null
  if (hasPendingUploads.value) { card.feedbackError = t('productCards.waitUploads'); return }
  const payload = buildPayload(card)
  if (!payload.title) { card.feedbackError = t('productCards.titleRequired'); return }
  if (!payload.description) { card.feedbackError = t('productCards.descriptionRequired'); return }
  if (!payload.workspaceIds.length) { card.feedbackError = t('productCards.workspaceRequired'); return }
  card.submitting = true
  try {
    if (editingCardId.value) await update(editingCardId.value, payload)
    else await create(payload)
    modalCommitted.value = true
    modalOpen.value = false
    if (selectedWorkspaceId.value) await reloadCards(selectedWorkspaceId.value)
  } catch (error) {
    card.feedbackError = uploadErrorMessage(error) || t('productCards.saveFailed')
  } finally {
    card.submitting = false
  }
}

async function removeCard(cardId: string) {
  if (!selectedWorkspaceId.value) return
  try {
    await remove(cardId, selectedWorkspaceId.value)
    await reloadCards(selectedWorkspaceId.value)
  } catch (error) {
    cardsError.value = uploadErrorMessage(error) || t('productCards.deleteFailed')
  }
}

function removePreview(previewId: string) {
  if (!draft.value) return
  const preview = draft.value.previews.find((p) => p.id === previewId)
  if (preview?.key && sessionUploadedKeys.value.includes(preview.key)) {
    void removeObject(preview.key).catch(() => {})
    sessionUploadedKeys.value = sessionUploadedKeys.value.filter((k) => k !== preview.key)
  }
  draft.value.previews = draft.value.previews.filter((p) => p.id !== previewId)
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  input.value = ''
  if (files?.length) void handleFilesForDraft(files)
}

function onDropzoneDragEnter(e: DragEvent) { e.preventDefault(); dragDepth.value += 1 }
function onDropzoneDragOver(e: DragEvent) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy' }
function onDropzoneDragLeave() { dragDepth.value = Math.max(0, dragDepth.value - 1) }
function onDropzoneDrop(e: DragEvent) { e.preventDefault(); dragDepth.value = 0; if (e.dataTransfer?.files?.length) void handleFilesForDraft(e.dataTransfer.files) }
function openFilePicker() { nextTick(() => fileInputRef.value?.click()) }
function descriptionPreview(text: string) { const trimmed = text.trim(); return !trimmed ? '' : trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed }
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <input ref="fileInput" type="file" class="sr-only" :accept="ACCEPT" multiple @change="onFileInputChange">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{{ $t('productCards.title') }}</h1>
          <p class="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{{ $t('productCards.subtitle') }}</p>
        </div>
        <div v-if="ownerWorkspaces.length" class="max-w-sm">
          <label class="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{{ $t('productCards.workspaceFilterLabel') }}</label>
          <select v-model="selectedWorkspaceId" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-primary-400 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option v-for="workspace in ownerWorkspaces" :key="workspace.id" :value="workspace.id">{{ workspace.name }}</option>
          </select>
        </div>
      </div>
      <UButton color="primary" class="rounded-full cursor-pointer" :label="$t('productCards.addCard')" :disabled="!ownerWorkspaces.length" @click="openCreateModal" />
    </div>

    <UAlert v-if="!ownerWorkspaces.length" color="warning" variant="subtle" icon="i-lucide-alert-circle" :title="$t('productCards.noOwnerWorkspace')" />
    <UAlert v-else-if="cardsError" color="error" variant="subtle" icon="i-lucide-alert-circle" :title="cardsError" class="mb-4" />

    <div v-if="ownerWorkspaces.length && !cardsPending && !cards.length" class="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-200">{{ $t('productCards.emptyTitle') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{{ $t('productCards.emptyHint') }}</p>
      <UButton color="primary" class="mt-6 rounded-full cursor-pointer" :label="$t('productCards.addCard')" @click="openCreateModal" />
    </div>

    <ul v-else-if="ownerWorkspaces.length" class="space-y-3">
      <li v-for="card in cards" :key="card.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ card.title }}</p>
          <p class="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-300">{{ descriptionPreview(card.description) || $t('productCards.descriptionPreviewEmpty') }}</p>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ $t('productCards.cardPreviewCount', { count: card.previewImages.length }) }}</p>
        </div>
        <div class="flex gap-2">
          <UButton color="primary" variant="outline" size="sm" class="rounded-full cursor-pointer" :label="$t('productCards.editCard')" @click="openEditModal(card)" />
          <UButton color="error" variant="outline" size="sm" class="rounded-full cursor-pointer" :label="$t('productCards.deleteCard')" @click="removeCard(card.id)" />
        </div>
      </li>
    </ul>

    <UModal v-model:open="modalOpen" :title="modalTitle" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div v-if="draft" class="space-y-4 p-4 sm:p-6">
          <UFormField :label="$t('productCards.titleLabel')" name="draft-title"><UInput v-model="draft.title" class="w-full" :placeholder="$t('productCards.titlePlaceholder')" /></UFormField>
          <UFormField :label="$t('productCards.descriptionLabel')" name="draft-description"><UTextarea v-model="draft.description" :rows="4" class="w-full" :placeholder="$t('productCards.descriptionPlaceholder')" autoresize /></UFormField>
          <div>
            <p class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{{ $t('productCards.workspaceLabel') }}</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <label v-for="workspace in ownerWorkspaces" :key="workspace.id" class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" :checked="draft.workspaceIds.includes(workspace.id)" @change="toggleWorkspace(workspace.id, ($event.target as HTMLInputElement).checked)">
                <span class="truncate">{{ workspace.name }}</span>
              </label>
            </div>
          </div>
          <UAlert v-if="draft.feedbackError" color="error" variant="subtle" :title="draft.feedbackError" icon="i-lucide-alert-circle" />
          <div>
            <p class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{{ $t('productCards.previewsLabel') }}</p>
            <div class="rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors" :class="[isDropzoneActive ? 'border-primary-500 bg-primary-50/80 dark:bg-primary-950/30' : 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40', draft.previews.length >= MAX_PREVIEWS ? 'pointer-events-none opacity-60' : '']" @dragenter="onDropzoneDragEnter" @dragover="onDropzoneDragOver" @dragleave="onDropzoneDragLeave" @drop="onDropzoneDrop">
              <UIcon name="i-lucide-upload-cloud" class="mx-auto mb-2 size-10 text-slate-400 dark:text-slate-500" />
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ $t('productCards.dropzoneHint') }}</p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ $t('productCards.dropzoneFormats') }}</p>
              <UButton color="primary" variant="outline" size="sm" class="mt-4 rounded-full cursor-pointer" :label="$t('productCards.addImages')" :disabled="draft.previews.length >= MAX_PREVIEWS" @click="openFilePicker" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div v-for="preview in draft.previews" :key="preview.id" class="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              <div v-if="preview.pending" class="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px] text-slate-500 dark:text-slate-400"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-primary-500" /><span>{{ $t('productCards.uploading') }}</span></div>
              <template v-else-if="preview.objectUrl">
                <img :src="preview.objectUrl" alt="" class="h-full w-full object-cover">
                <UButton color="neutral" variant="solid" size="xs" icon="i-lucide-x" class="absolute right-0.5 top-0.5 rounded-full cursor-pointer opacity-90" :aria-label="$t('productCards.removePreview')" @click="removePreview(preview.id)" />
              </template>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2 p-4">
          <UButton color="neutral" variant="outline" class="rounded-full cursor-pointer" :label="$t('productCards.cancel')" @click="modalOpen = false" />
          <UButton color="primary" class="rounded-full cursor-pointer" :label="$t('productCards.save')" :loading="Boolean(draft?.submitting)" :disabled="!draft || hasPendingUploads" @click="saveDraft" />
        </div>
      </template>
    </UModal>
  </div>
</template>

