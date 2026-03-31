<script setup lang="ts">
import type { Client } from '~/composables/useClientsApi'
import type { Workspace } from '~/composables/useWorkspacesApi'
import type { UserSearchItem } from '~/composables/useUsersApi'
import { watchDebounced } from '@vueuse/core'

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
const { listForWorkspace } = useClientsApi()
const { search: searchUsers } = useUsersApi()
const { create: createInvite } = useWorkspaceInvitesApi()

await useAsyncData('dashboard-init', async () => {
  await Promise.all([
    botsStore.fetchBots({ page: 1, limit: 20 }),
    wsStore.fetchMy().catch(() => {}),
  ])
  return true
})

const selectedWorkspaceId = ref<string | null>(null)
const clients = ref<Client[]>([])
const clientsPending = ref(false)
const clientsError = ref<string | null>(null)

function upsertClient(nextClient: Client) {
  const idx = clients.value.findIndex((client) => client.id === nextClient.id || client.telegramId === nextClient.telegramId)
  if (idx === -1) {
    clients.value = [nextClient, ...clients.value]
    return
  }
  const clone = [...clients.value]
  clone[idx] = { ...clone[idx], ...nextClient }
  clients.value = clone
}

watch(
  () => wsStore.workspaces,
  (items) => {
    if (!items.length) {
      selectedWorkspaceId.value = null
      return
    }
    if (!selectedWorkspaceId.value || !items.some((workspace) => workspace.id === selectedWorkspaceId.value)) {
      selectedWorkspaceId.value = items[0]?.id ?? null
    }
  },
  { immediate: true, deep: true },
)

watch(
  selectedWorkspaceId,
  async (workspaceId) => {
    if (!workspaceId) {
      clients.value = []
      clientsError.value = null
      return
    }
    clientsPending.value = true
    clientsError.value = null
    try {
      clients.value = await listForWorkspace(workspaceId)
    } catch (error) {
      clientsError.value = error instanceof Error ? error.message : String(error)
    } finally {
      clientsPending.value = false
    }
  },
  { immediate: true },
)

useWorkspaceWss(selectedWorkspaceId, {
  onClientStart(client, workspaceIds) {
    if (!selectedWorkspaceId.value) return
    if (!workspaceIds.includes(selectedWorkspaceId.value)) return
    upsertClient(client)
  },
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

const inviteOpen = ref(false)
const inviteTarget = ref<Workspace | null>(null)
const inviteQuery = ref('')
const inviteHits = ref<UserSearchItem[]>([])
const inviteLoading = ref(false)
const pickedInviteUser = ref<UserSearchItem | null>(null)

function openInvite(w: Workspace) {
  inviteTarget.value = w
  inviteQuery.value = ''
  inviteHits.value = []
  pickedInviteUser.value = null
  inviteOpen.value = true
}

function userSearchLabel(u: UserSearchItem) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  if (name && u.username) return `${name} (@${u.username})`
  if (u.username) return `@${u.username}`
  return name || u.id.slice(0, 8)
}

watchDebounced(
  [inviteQuery, inviteOpen, inviteTarget],
  async () => {
    if (!inviteOpen.value || !inviteTarget.value) return
    const q = inviteQuery.value.trim()
    if (q.length < 1) {
      inviteHits.value = []
      return
    }
    inviteLoading.value = true
    try {
      inviteHits.value = await searchUsers(inviteTarget.value.id, q)
    } catch {
      inviteHits.value = []
    } finally {
      inviteLoading.value = false
    }
  },
  { debounce: 300 },
)

async function sendWorkspaceInvite() {
  const w = inviteTarget.value
  const u = pickedInviteUser.value
  if (!w || !u) return
  try {
    await createInvite(w.id, u.id)
    toast.add({ title: t('dashboard.workspaceInviteSuccess'), color: 'success' })
    inviteOpen.value = false
  } catch {
    toast.add({ title: t('dashboard.workspaceInviteError'), color: 'error' })
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
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

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div class="space-y-10">
        <section>
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
                <UButton
                  color="primary"
                  variant="soft"
                  size="sm"
                  square
                  class="rounded-full"
                  icon="i-lucide-plus"
                  :title="$t('dashboard.workspaceInvite')"
                  :aria-label="$t('dashboard.workspaceInvite')"
                  @click="openInvite(w)"
                />
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
      </div>

      <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <UCard class="border-slate-200 shadow-sm dark:border-slate-800">
          <template #header>
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                {{ $t('dashboard.clientsTitle') }}
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{ $t('dashboard.clientsHint') }}
              </p>
            </div>
          </template>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ $t('dashboard.clientsWorkspaceLabel') }}
              </label>
              <select
                v-model="selectedWorkspaceId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option v-for="workspace in wsStore.workspaces" :key="workspace.id" :value="workspace.id">
                  {{ workspace.name }}
                </option>
              </select>
            </div>

            <p v-if="clientsPending" class="text-sm text-slate-500 dark:text-slate-400">
              {{ $t('dashboard.clientsLoading') }}
            </p>
            <p v-else-if="clientsError" class="text-sm text-rose-600 dark:text-rose-400">
              {{ $t('dashboard.clientsError') }}
            </p>
            <p
              v-else-if="!clients.length"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400"
            >
              {{ $t('dashboard.clientsEmpty') }}
            </p>

            <ul v-else class="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              <li
                v-for="client in clients"
                :key="client.id"
                class="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              >
                <p class="font-medium text-slate-900 dark:text-slate-100">
                  {{ client.firstName || client.username || client.telegramId }}
                </p>
                <p v-if="client.username" class="text-xs text-slate-500 dark:text-slate-400">
                  @{{ client.username }}
                </p>
                <p v-if="client.createdAt" class="text-xs text-slate-500 dark:text-slate-400">
                  {{ $t('dashboard.connectedAt') }}: {{ formatDate(client.createdAt) }}
                </p>
              </li>
            </ul>
          </div>
        </UCard>
      </aside>
    </div>

    <Teleport to="body">
      <div
        v-if="inviteOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="inviteOpen = false"
      >
        <UCard class="w-full max-w-md">
          <template #header>
            <span class="font-semibold">{{ $t('dashboard.workspaceInvite') }}</span>
          </template>
          <div class="space-y-4">
            <p v-if="inviteTarget" class="text-sm text-slate-600 dark:text-slate-400">
              {{ inviteTarget.name }}
            </p>
            <UInput
              v-model="inviteQuery"
              :placeholder="$t('dashboard.workspaceInviteSearch')"
              icon="i-lucide-search"
              class="w-full"
            />
            <p v-if="inviteLoading" class="text-xs text-slate-500">
              …
            </p>
            <p v-else-if="inviteQuery.trim().length > 0 && !inviteHits.length" class="text-xs text-slate-500">
              {{ $t('dashboard.workspaceInviteNoResults') }}
            </p>
            <ul
              v-else-if="inviteHits.length"
              class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <li v-for="u in inviteHits" :key="u.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  :class="
                    pickedInviteUser?.id === u.id ? 'bg-primary-50 dark:bg-primary-950/40' : ''
                  "
                  @click="pickedInviteUser = u"
                >
                  <UAvatar v-if="u.photoUrl" :src="u.photoUrl" size="xs" alt="" />
                  <UAvatar v-else :text="userSearchLabel(u)" size="xs" />
                  <span>{{ userSearchLabel(u) }}</span>
                </button>
              </li>
            </ul>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" class="rounded-full" @click="inviteOpen = false">
                {{ $t('dashboard.workspaceCancel') }}
              </UButton>
              <UButton
                color="primary"
                class="rounded-full"
                :disabled="!pickedInviteUser"
                @click="sendWorkspaceInvite"
              >
                {{ $t('dashboard.workspaceInviteSend') }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </Teleport>

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
