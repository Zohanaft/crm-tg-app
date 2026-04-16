<script setup lang="ts">
definePageMeta({
  middleware: 'auth-private',
})

const { t } = useI18n()
const { upload, removeObject } = useYcStorageUpload()

const MAX_PREVIEWS = 6
const MAX_BYTES = 2 * 1024 * 1024
const UPLOAD_PREFIX = 'product-cards'
const ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'

type PreviewItem = {
  id: string
  objectUrl: string | null
  key?: string
  pending: boolean
  error?: string | null
}

type ProductCard = {
  id: string
  description: string
  previews: PreviewItem[]
  feedbackError: string | null
}

const cards = ref<ProductCard[]>([])
const modalOpen = ref(false)
const modalCommitted = ref(false)
const editingCardId = ref<string | null>(null)
const draft = ref<ProductCard | null>(null)
/** S3 keys uploaded successfully during the current modal session (create/edit). Rolled back on close without save. */
const sessionUploadedKeys = ref<string[]>([])

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput')

const dragDepth = ref(0)
const isDropzoneActive = computed(() => dragDepth.value > 0)

const modalTitle = computed(() =>
  editingCardId.value ? t('productCards.modalTitleEdit') : t('productCards.modalTitleCreate'),
)

/** Serializes all uploads through one chain so files never upload in parallel. */
let uploadChain = Promise.resolve()

function enqueueUpload(file: File) {
  const run = uploadChain.then(() => upload(file, { prefix: UPLOAD_PREFIX }))
  uploadChain = run.then(() => {}).catch(() => {})
  return run
}

function newCard(): ProductCard {
  return {
    id: crypto.randomUUID(),
    description: '',
    previews: [],
    feedbackError: null,
  }
}

function clearFeedback(card: ProductCard) {
  card.feedbackError = null
}

function validateImage(file: File): string | null {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    return t('productCards.invalidType')
  }
  if (file.size > MAX_BYTES) {
    return t('productCards.fileTooLarge')
  }
  return null
}

function uploadErrorMessage(error: unknown): string {
  const e = error as {
    data?: { message?: string; statusMessage?: string }
    message?: string
    statusMessage?: string
  }
  const fromData =
    typeof e?.data?.message === 'string'
      ? e.data.message
      : typeof e?.data?.statusMessage === 'string'
        ? e.data.statusMessage
        : ''
  const plain =
    typeof e?.message === 'string' && e.message !== '[object Object]'
      ? e.message
      : typeof e?.statusMessage === 'string'
        ? e.statusMessage
        : ''
  return (fromData || plain).trim()
}

async function discardSessionUploads() {
  const keys = [...sessionUploadedKeys.value]
  for (const key of keys) {
    await removeObject(key).catch(() => {})
  }
  sessionUploadedKeys.value = []
}

watch(modalOpen, async (open) => {
  if (!open) {
    if (!modalCommitted.value) {
      await discardSessionUploads()
    }
    draft.value = null
    editingCardId.value = null
    sessionUploadedKeys.value = []
    modalCommitted.value = false
    dragDepth.value = 0
  }
})

function openCreateModal() {
  editingCardId.value = null
  draft.value = newCard()
  sessionUploadedKeys.value = []
  modalCommitted.value = false
  modalOpen.value = true
}

function openEditModal(card: ProductCard) {
  editingCardId.value = card.id
  draft.value = {
    id: card.id,
    description: card.description,
    previews: card.previews.map((p) => ({ ...p })),
    feedbackError: null,
  }
  sessionUploadedKeys.value = []
  modalCommitted.value = false
  modalOpen.value = true
}

function saveDraft() {
  const d = draft.value
  if (!d) return
  const snapshot = structuredClone(d) as ProductCard
  modalCommitted.value = true
  if (editingCardId.value) {
    cards.value = cards.value.map((c) => (c.id === editingCardId.value ? snapshot : c))
  } else {
    cards.value = [...cards.value, snapshot]
  }
  modalOpen.value = false
}

function cancelModal() {
  modalOpen.value = false
}

async function handleFilesForDraft(files: File[] | FileList) {
  const card = draft.value
  if (!card) return

  clearFeedback(card)
  const list = files instanceof FileList ? Array.from(files) : files

  for (const file of list) {
    if (card.previews.length >= MAX_PREVIEWS) {
      card.feedbackError = t('productCards.maxImages')
      break
    }

    const validationMsg = validateImage(file)
    if (validationMsg) {
      card.feedbackError = validationMsg
      continue
    }

    const previewId = crypto.randomUUID()
    card.previews.push({
      id: previewId,
      objectUrl: null,
      pending: true,
    })

    try {
      const res = await enqueueUpload(file)
      const idx = card.previews.findIndex((p) => p.id === previewId)
      if (idx !== -1) {
        const next = [...card.previews]
        next[idx] = {
          id: previewId,
          objectUrl: res.signedUrl,
          key: res.key,
          pending: false,
        }
        card.previews = next
      }
      sessionUploadedKeys.value = [...sessionUploadedKeys.value, res.key]
    } catch (err) {
      const next = card.previews.filter((p) => p.id !== previewId)
      card.previews = next
      card.feedbackError = uploadErrorMessage(err) || t('productCards.uploadFailed')
    }
  }
}

function openFilePicker() {
  nextTick(() => {
    fileInputRef.value?.click()
  })
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  input.value = ''
  if (!files?.length) return
  void handleFilesForDraft(files)
}

function onDropzoneDragEnter(e: DragEvent) {
  e.preventDefault()
  dragDepth.value += 1
}

function onDropzoneDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function onDropzoneDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDropzoneDrop(e: DragEvent) {
  e.preventDefault()
  dragDepth.value = 0
  const files = e.dataTransfer?.files
  if (!files?.length) return
  void handleFilesForDraft(files)
}

function removePreview(previewId: string) {
  const card = draft.value
  if (!card) return
  const p = card.previews.find((x) => x.id === previewId)
  if (p?.key && sessionUploadedKeys.value.includes(p.key)) {
    void removeObject(p.key).catch(() => {})
    sessionUploadedKeys.value = sessionUploadedKeys.value.filter((k) => k !== p.key)
  }
  card.previews = card.previews.filter((x) => x.id !== previewId)
  clearFeedback(card)
}

function descriptionPreview(text: string): string {
  const t = text.trim()
  if (!t) return ''
  return t.length > 120 ? `${t.slice(0, 120)}…` : t
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <input
      ref="fileInput"
      type="file"
      class="sr-only"
      :accept="ACCEPT"
      multiple
      @change="onFileInputChange"
    >

    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {{ $t('productCards.title') }}
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          {{ $t('productCards.subtitle') }}
        </p>
      </div>
      <UButton
        color="primary"
        class="shrink-0 rounded-full cursor-pointer"
        :label="$t('productCards.addCard')"
        @click="openCreateModal"
      />
    </div>

    <div
      v-if="!cards.length"
      class="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50"
    >
      <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-200">
        {{ $t('productCards.emptyTitle') }}
      </h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {{ $t('productCards.emptyHint') }}
      </p>
      <UButton
        color="primary"
        class="mt-6 rounded-full cursor-pointer"
        :label="$t('productCards.addCard')"
        @click="openCreateModal"
      />
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="card in cards"
        :key="card.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
            {{ descriptionPreview(card.description) || $t('productCards.descriptionPreviewEmpty') }}
          </p>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {{ $t('productCards.cardPreviewCount', { count: card.previews.length }) }}
          </p>
        </div>
        <UButton
          color="primary"
          variant="outline"
          size="sm"
          class="shrink-0 rounded-full cursor-pointer"
          :label="$t('productCards.editCard')"
          @click="openEditModal(card)"
        />
      </li>
    </ul>

    <UModal
      v-model:open="modalOpen"
      :title="modalTitle"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div v-if="draft" class="space-y-4 p-4 sm:p-6">
          <UFormField :label="$t('productCards.descriptionLabel')" name="draft-description">
            <UTextarea
              v-model="draft.description"
              :rows="4"
              class="w-full"
              :placeholder="$t('productCards.descriptionPlaceholder')"
              autoresize
            />
          </UFormField>

          <UAlert
            v-if="draft.feedbackError"
            color="error"
            variant="subtle"
            :title="draft.feedbackError"
            icon="i-lucide-alert-circle"
          />

          <div>
            <p class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {{ $t('productCards.previewsLabel') }}
            </p>
            <div
              class="rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
              :class="[
                isDropzoneActive
                  ? 'border-primary-500 bg-primary-50/80 dark:bg-primary-950/30'
                  : 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40',
                draft.previews.length >= MAX_PREVIEWS ? 'pointer-events-none opacity-60' : '',
              ]"
              @dragenter="onDropzoneDragEnter"
              @dragover="onDropzoneDragOver"
              @dragleave="onDropzoneDragLeave"
              @drop="onDropzoneDrop"
            >
              <UIcon
                name="i-lucide-upload-cloud"
                class="mx-auto mb-2 size-10 text-slate-400 dark:text-slate-500"
              />
              <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ $t('productCards.dropzoneHint') }}
              </p>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ $t('productCards.dropzoneFormats') }}
              </p>
              <UButton
                color="primary"
                variant="outline"
                size="sm"
                class="mt-4 rounded-full cursor-pointer"
                :label="$t('productCards.addImages')"
                :disabled="draft.previews.length >= MAX_PREVIEWS"
                @click="openFilePicker"
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div
              v-for="p in draft.previews"
              :key="p.id"
              class="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            >
              <div
                v-if="p.pending"
                class="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px] text-slate-500 dark:text-slate-400"
              >
                <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-primary-500" />
                <span>{{ $t('productCards.uploading') }}</span>
              </div>
              <template v-else-if="p.objectUrl">
                <img
                  :src="p.objectUrl"
                  alt=""
                  class="h-full w-full object-cover"
                >
                <UButton
                  color="neutral"
                  variant="solid"
                  size="xs"
                  icon="i-lucide-x"
                  class="absolute right-0.5 top-0.5 rounded-full cursor-pointer opacity-90"
                  :aria-label="$t('productCards.removePreview')"
                  @click="removePreview(p.id)"
                />
              </template>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2 p-4">
          <UButton
            color="neutral"
            variant="outline"
            class="rounded-full cursor-pointer"
            :label="$t('productCards.cancel')"
            @click="cancelModal"
          />
          <UButton
            color="primary"
            class="rounded-full cursor-pointer"
            :label="$t('productCards.save')"
            :disabled="!draft"
            @click="saveDraft"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
