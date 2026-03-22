<script setup lang="ts">
import type { Workspace } from '~/composables/useWorkspacesApi'

definePageMeta({
  middleware: 'auth-private',
})

const { t } = useI18n()
const deleteModalHeading = computed(() => t('dashboard.confirmDeleteBotHeading'))
const toast = useToast()
const userStore = useUserStore()
const user = computed(() => userStore.user)
const userDisplayName = computed(() => {
  const u = user.value
  if (!u) return ''
  return (u.firstName ?? u.username ?? 'User').trim() || 'User'
})
const botsStore = useBotsStore()
const wsStore = useWorkspacesStore()

await useAsyncData('dashboard-init', async () => {
  await Promise.all([
    botsStore.fetchBots({ page: 1, limit: 20 }),
    wsStore.fetchMy().catch(() => {}),
  ])
  return true
})

const renameOpen = ref(false)
const renameWs = ref<Workspace | null>(null)
const renameInput = ref('')
function openRename(w: Workspace) {
  renameWs.value = w
  renameInput.value = w.name
  renameOpen.value = true
}
async function saveRename() {
  const w = renameWs.value
  if (!w || !renameInput.value.trim()) return
  try {
    await wsStore.updateName(w.id, renameInput.value.trim())
    toast.add({ title: t('dashboard.workspaceSave'), color: 'success' })
    renameOpen.value = false
  } catch {
    toast.add({ title: t('dashboard.workspacesError'), color: 'error' })
  }
}

const createOpen = ref(false)
const createName = ref('')
function openCreate() {
  createName.value = ''
  createOpen.value = true
}
async function saveCreate() {
  const name = createName.value.trim() || t('dashboard.createWorkspace')
  try {
    await wsStore.create(name)
    toast.add({ title: t('dashboard.workspaceCreate'), color: 'success' })
    createOpen.value = false
  } catch {
    toast.add({ title: t('dashboard.workspacesError'), color: 'error' })
  }
}

const deleteBotId = ref<string | null>(null)
function openDeleteBot(botId: string) {
  deleteBotId.value = botId
}
async function confirmDeleteBot() {
  const id = deleteBotId.value
  if (!id) return
  try {
    await botsStore.deleteBot(id)
    toast.add({ title: t('dashboard.botRemoved'), color: 'success' })
    deleteBotId.value = null
  } catch {
    toast.add({ title: t('dashboard.botRemoveError'), color: 'error' })
  }
}

const deleteWsId = ref<string | null>(null)
const deleteWsName = ref('')
function openDeleteWorkspace(w: Workspace) {
  deleteWsId.value = w.id
  deleteWsName.value = w.name
}
async function confirmDeleteWorkspace() {
  const id = deleteWsId.value
  if (!id) return
  try {
    await wsStore.deleteWorkspace(id)
    toast.add({ title: t('dashboard.workspaceDeleted'), color: 'success' })
    deleteWsId.value = null
  } catch {
    toast.add({ title: t('dashboard.workspaceDeleteError'), color: 'error' })
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {{ $t('dashboard.title') }}
      </h1>
      <p v-if="user" class="mt-2 text-slate-600 dark:text-slate-400">
        {{ $t('dashboard.welcome') }}, {{ user.firstName ?? user.username ?? 'User' }}
      </p>

      <div class="mt-6">
        <UButton
          to="/connect-bot"
          color="primary"
          variant="solid"
          class="rounded-full"
          :label="$t('dashboard.connectBot')"
        />
      </div>
    </div>

    <section class="mb-10">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {{ $t('dashboard.workspacesTitle') }}
          </h2>
          <p class="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {{ $t('dashboard.workspacesOwnerHint') }}
          </p>
        </div>
        <UButton color="primary" variant="outline" size="sm" class="rounded-full" @click="openCreate">
          {{ $t('dashboard.createWorkspace') }}
        </UButton>
      </div>
      <p v-if="wsStore.pending" class="text-slate-500 dark:text-slate-400">
        {{ $t('dashboard.workspacesLoading') }}
      </p>
      <p v-else-if="wsStore.error" class="text-rose-600 dark:text-rose-400">
        {{ $t('dashboard.workspacesError') }}
      </p>
      <p
        v-else-if="wsStore.isEmpty"
        class="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400"
      >
        {{ $t('dashboard.workspacesEmptyHint') }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="w in wsStore.workspaces"
          :key="w.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <span class="font-medium text-slate-900 dark:text-white">{{ w.name }}</span>
            <UBadge
              v-if="user?.id === w.ownerId"
              color="primary"
              variant="subtle"
              class="shrink-0"
            >
              {{ $t('dashboard.workspaceOwnerBadge') }}
            </UBadge>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-1">
            <UButton color="neutral" variant="ghost" size="sm" class="rounded-full" @click="openRename(w)">
              {{ $t('dashboard.workspaceRename') }}
            </UButton>
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              square
              class="rounded-full"
              icon="i-lucide-trash-2"
              :title="$t('dashboard.workspaceDelete')"
              :aria-label="$t('dashboard.workspaceDelete')"
              @click="openDeleteWorkspace(w)"
            />
          </div>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
        {{ $t('dashboard.botsList') }}
      </h2>
      <p v-if="botsStore.pending" class="text-slate-500 dark:text-slate-400">
        {{ $t('dashboard.botsLoading') }}
      </p>
      <p v-else-if="botsStore.error" class="text-rose-600 dark:text-rose-400">
        {{ $t('dashboard.botsError') }}
      </p>
      <p
        v-else-if="botsStore.isEmpty"
        class="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400"
      >
        {{ $t('dashboard.botsEmpty') }}
      </p>
      <div v-else class="space-y-4">
        <UCard
          v-for="bot in botsStore.bots"
          :key="bot.id"
          class="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-semibold text-slate-900 dark:text-white">
                {{ bot.firstName ?? bot.username ?? 'Bot' }}
                <span v-if="bot.username" class="ml-1 text-slate-500 dark:text-slate-400">@{{ bot.username }}</span>
              </p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {{ $t('dashboard.botBoundToYou', { name: userDisplayName }) }}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{ $t('dashboard.connectedAt') }}: {{ formatDate(bot.createdAt) }}
              </p>
            </div>
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              square
              class="shrink-0 rounded-full"
              icon="i-lucide-trash-2"
              :title="$t('dashboard.deleteBot')"
              :aria-label="$t('dashboard.deleteBot')"
              @click="openDeleteBot(bot.botId)"
            />
          </div>
        </UCard>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="renameOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="renameOpen = false"
      >
        <UCard class="w-full max-w-md">
          <template #header>
            <span class="font-semibold">{{ $t('dashboard.workspaceRename') }}</span>
          </template>
          <div class="space-y-4">
            <UInput v-model="renameInput" :placeholder="$t('dashboard.workspaceName')" class="w-full" />
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" class="rounded-full" @click="renameOpen = false">
                {{ $t('dashboard.workspaceCancel') }}
              </UButton>
              <UButton color="primary" class="rounded-full" @click="saveRename">
                {{ $t('dashboard.workspaceSave') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="createOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="createOpen = false"
      >
        <UCard class="w-full max-w-md">
          <template #header>
            <span class="font-semibold">{{ $t('dashboard.createWorkspace') }}</span>
          </template>
          <div class="space-y-4">
            <UInput v-model="createName" :placeholder="$t('dashboard.workspaceName')" class="w-full" />
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" class="rounded-full" @click="createOpen = false">
                {{ $t('dashboard.workspaceCancel') }}
              </UButton>
              <UButton color="primary" class="rounded-full" @click="saveCreate">
                {{ $t('dashboard.workspaceCreate') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="deleteWsId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="deleteWsId = null"
      >
        <UCard class="w-full max-w-md">
          <template #header>
            <span class="font-semibold">{{ $t('dashboard.workspaceDelete') }}</span>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ $t('dashboard.workspaceDeleteConfirm', { name: deleteWsName }) }}
            </p>
            <div class="flex flex-wrap justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" class="rounded-full" @click="deleteWsId = null">
                {{ $t('dashboard.workspaceCancel') }}
              </UButton>
              <UButton
                color="error"
                variant="solid"
                class="rounded-full"
                trailing-icon="i-lucide-trash-2"
                @click="confirmDeleteWorkspace"
              >
                {{ $t('dashboard.workspaceDeleteAction') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="deleteBotId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="deleteBotId = null"
      >
        <UCard class="w-full max-w-md">
          <template #header>
            <span class="font-semibold">{{ $t('dashboard.deleteBot') }}</span>
          </template>
          <div class="space-y-4">
            <p class="font-medium text-slate-800 dark:text-slate-200">
              {{ deleteModalHeading }}
            </p>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ $t('dashboard.deleteBotConfirm') }}
            </p>
            <div class="flex flex-wrap justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" class="rounded-full" @click="deleteBotId = null">
                {{ $t('dashboard.workspaceCancel') }}
              </UButton>
              <UButton
                color="error"
                variant="solid"
                class="rounded-full"
                trailing-icon="i-lucide-trash-2"
                @click="confirmDeleteBot"
              >
                {{ $t('dashboard.deleteBotConfirmAction') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </Teleport>
  </div>
</template>
