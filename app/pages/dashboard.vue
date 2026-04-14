<script setup lang="ts">
import type { Client } from '~/composables/useClientsApi'
import type { Workspace, WorkspaceMember } from '~/composables/useWorkspacesApi'
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

function tf(key: string, fallback: string) {
  const v = t(key)
  return v === key ? fallback : v
}
const botsStore = useBotsStore()
const wsStore = useWorkspacesStore()
const { listForWorkspace, removeForWorkspace } = useClientsApi()
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
const failedAvatarByClientId = ref<Record<string, boolean>>({})
const failedAvatarByMemberUserId = ref<Record<string, boolean>>({})

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

function removeClientFromList(clientId: string) {
  clients.value = clients.value.filter((client) => client.id !== clientId)
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

const ownerWorkspaces = computed(() =>
  wsStore.workspaces.filter((w) => w.ownerId === user.value?.id),
)
const memberWorkspaces = computed(() =>
  wsStore.workspaces.filter((w) => w.ownerId !== user.value?.id),
)
const selectedWorkspaceName = computed(
  () => wsStore.workspaces.find((w) => w.id === selectedWorkspaceId.value)?.name ?? '',
)

watch(
  () => wsStore.workspaces,
  (items) => {
    for (const w of items) {
      if (w.members === undefined) {
        void wsStore.fetchMembers(w.id).catch(() => {})
      }
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

let clientsSyncChannel: BroadcastChannel | null = null
onMounted(() => {
  if (typeof BroadcastChannel === 'undefined') return
  clientsSyncChannel = new BroadcastChannel('tg-crm-wss-sync-v1')
  clientsSyncChannel.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as
      | { type: 'client:start'; client?: Client; workspaceIds?: string[] }
      | { type: 'client:deleted'; clientId?: string; workspaceIds?: string[] }
      | {
          type: 'workspace:member_joined'
          workspaceId?: string
          member?: Record<string, unknown>
        }
      | undefined
    if (!msg) return
    if (msg.type === 'workspace:member_joined') {
      const wid = msg.workspaceId
      const member = msg.member
      if (
        typeof wid === 'string'
        && member
        && typeof member.userId === 'string'
      ) {
        wsStore.upsertMember(wid, {
          userId: member.userId,
          username:
            member.username === null || member.username === undefined
              ? null
              : String(member.username),
          firstName:
            member.firstName === null || member.firstName === undefined
              ? null
              : String(member.firstName),
          lastName:
            member.lastName === null || member.lastName === undefined
              ? null
              : String(member.lastName),
          photoUrl:
            member.photoUrl === null || member.photoUrl === undefined
              ? null
              : String(member.photoUrl),
        })
      }
      return
    }
    if (!selectedWorkspaceId.value) return
    if (!Array.isArray(msg.workspaceIds) || !msg.workspaceIds.includes(selectedWorkspaceId.value)) return
    if (msg.type === 'client:start') {
      if (!msg.client) return
      upsertClient(msg.client)
      return
    }
    if (msg.type === 'client:deleted' && msg.clientId) {
      removeClientFromList(msg.clientId)
      toast.add({ title: t('dashboard.clientRemoved'), color: 'success' })
    }
  })
})

onBeforeUnmount(() => {
  clientsSyncChannel?.close()
  clientsSyncChannel = null
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
  } catch (error) {
    type ApiErr = {
      data?: {
        code?: string
        params?: Record<string, unknown>
        message?: string | { code?: string; params?: Record<string, unknown> }
      }
      message?: string
    }
    const e = error as ApiErr
    const messageObj = typeof e?.data?.message === 'object' && e?.data?.message
      ? e.data.message
      : null
    const code = e?.data?.code || messageObj?.code
    const params = e?.data?.params || messageObj?.params || {}
    if (code === 'errors.workspaceLimitReached') {
      toast.add({
        title: t('errors.workspaceLimitReached', params),
        color: 'error',
      })
      return
    }
    const plainMessage = typeof e?.data?.message === 'string' ? e.data.message : null
    toast.add({ title: plainMessage || t('dashboard.workspacesError'), color: 'error' })
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

async function deleteClient(clientId: string) {
  if (!selectedWorkspaceId.value) return
  try {
    await removeForWorkspace(selectedWorkspaceId.value, clientId)
    removeClientFromList(clientId)
    clientsSyncChannel?.postMessage({
      type: 'client:deleted',
      clientId,
      workspaceIds: [selectedWorkspaceId.value],
    })
  } catch {
    toast.add({ title: t('dashboard.clientRemoveError'), color: 'error' })
  }
}

function selectWorkspace(id: string) {
  selectedWorkspaceId.value = id
}

function clientInitials(client: Client): string {
  const first = (client.firstName || '').trim()
  const last = (client.lastName || '').trim()
  if (first || last) {
    return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase()
  }
  const username = (client.username || '').trim()
  if (username) return username.slice(0, 1).toUpperCase()
  return '?'
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function clientAvatarGradient(client: Client): string {
  const presets = [
    'from-indigo-500 to-sky-500',
    'from-fuchsia-500 to-pink-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-violet-500 to-purple-500',
    'from-cyan-500 to-blue-500',
  ] as const
  const idx = hashString(`${client.id}:${client.telegramId}`) % presets.length
  return presets[idx] ?? 'from-indigo-500 to-sky-500'
}

function clientAvatarUrl(client: Client): string | null {
  if (!client.username) return null
  if (failedAvatarByClientId.value[client.id]) return null
  return `https://t.me/i/userpic/320/${encodeURIComponent(client.username)}.jpg`
}

function onClientAvatarError(clientId: string) {
  failedAvatarByClientId.value = {
    ...failedAvatarByClientId.value,
    [clientId]: true,
  }
}

const inviteOpen = ref(false)
const inviteTarget = ref<Workspace | null>(null)
const inviteQuery = ref('')
const inviteQueryNormalized = computed(() =>
  inviteQuery.value.trim().replace(/^@+/, ''),
)
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

function workspaceMemberLabel(m: WorkspaceMember) {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim()
  if (name && m.username) return `${name} (@${m.username})`
  if (m.username) return `@${m.username}`
  return name || m.userId.slice(0, 8)
}

function memberInitials(m: WorkspaceMember): string {
  const first = (m.firstName || '').trim()
  const last = (m.lastName || '').trim()
  if (first || last) {
    return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase()
  }
  const username = (m.username || '').trim()
  if (username) return username.slice(0, 1).toUpperCase()
  return '?'
}

function memberAvatarGradient(m: WorkspaceMember): string {
  const presets = [
    'from-indigo-500 to-sky-500',
    'from-fuchsia-500 to-pink-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-violet-500 to-purple-500',
    'from-cyan-500 to-blue-500',
  ] as const
  const idx = hashString(m.userId) % presets.length
  return presets[idx] ?? 'from-indigo-500 to-sky-500'
}

function memberAvatarUrl(m: WorkspaceMember): string | null {
  if (m.photoUrl) return m.photoUrl
  if (!m.username) return null
  if (failedAvatarByMemberUserId.value[m.userId]) return null
  return `https://t.me/i/userpic/320/${encodeURIComponent(m.username)}.jpg`
}

function onMemberAvatarError(userId: string) {
  failedAvatarByMemberUserId.value = {
    ...failedAvatarByMemberUserId.value,
    [userId]: true,
  }
}

function canRemoveWorkspaceMember(w: Workspace, m: WorkspaceMember): boolean {
  if (user.value?.id !== w.ownerId) return false
  if (m.userId === w.ownerId) return false
  return true
}

async function removeWorkspaceMember(w: Workspace, m: WorkspaceMember) {
  try {
    await wsStore.removeMemberViaApi(w.id, m.userId)
    clientsSyncChannel?.postMessage({
      type: 'workspace:member_removed',
      workspaceId: w.id,
      removedUserId: m.userId,
    })
    toast.add({
      title: t('dashboard.workspaceMemberRemovedSuccess'),
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('dashboard.workspaceMemberRemoveError'),
      color: 'error',
    })
  }
}

watchDebounced(
  [inviteQuery, inviteOpen, inviteTarget],
  async () => {
    if (!inviteOpen.value || !inviteTarget.value) return
    const q = inviteQuery.value.trim().replace(/^@+/, '')
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
    await wsStore.fetchMembers(w.id).catch(() => {})
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
          class="rounded-full cursor-pointer"
          :label="$t('dashboard.connectBot')"
        />
      </div>
    </div>

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
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
            <UButton color="primary" variant="outline" size="sm" class="rounded-full cursor-pointer" @click="openCreate">
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
          <div v-else class="space-y-6">
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ tf('dashboard.workspaceOwnersSection', 'Owner workspaces') }}
              </p>
              <ul class="grid gap-3 sm:grid-cols-2">
                <li
                  v-for="w in ownerWorkspaces"
                  :key="w.id"
                  class="rounded-xl border px-4 py-4 transition"
                  :class="[
                    selectedWorkspaceId === w.id
                      ? 'border-primary-400 bg-primary-50/60 dark:border-primary-500 dark:bg-primary-950/30'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                  ]"
                >
                  <button type="button" class="mb-3 w-full text-left" @click="selectWorkspace(w.id)">
                    <div class="flex items-center gap-2">
                      <p class="font-semibold text-slate-900 dark:text-white">{{ w.name }}</p>
                      <UBadge color="primary" variant="subtle" class="shrink-0">
                        {{ tf('dashboard.workspaceOwnerBadge', 'Owner') }}
                      </UBadge>
                    </div>
                  </button>
                  <div v-if="w.members === undefined" class="mb-2 text-xs text-slate-500 dark:text-slate-400">
                    {{ $t('dashboard.workspaceMembersLoading') }}
                  </div>
                  <template v-else>
                    <p class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {{ $t('dashboard.workspaceMembersTitle') }}
                    </p>
                    <div
                      v-if="w.members.length"
                      class="mb-3 max-h-56 overflow-y-auto"
                    >
                      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div
                          v-for="m in w.members"
                          :key="`${m.id}-${m.userId}`"
                          class="relative rounded-xl border border-slate-200 bg-slate-50/90 px-2 pb-7 pt-6 text-center dark:border-slate-700 dark:bg-slate-900/50"
                        >
                          <div class="relative mx-auto mb-2 w-fit">
                            <span
                              class="absolute flex left-0 right-0 top-0 z-10"
                            >
                              <span class="absolute flex justify-center items-center h-5 w-5 top-1/4 -left-1/6 rounded-full bg-white shadow-md ring-2 ring-white dark:bg-slate-900 dark:ring-slate-800">
                                <UIcon
                                  :name="m.userId === w.ownerId ? 'i-lucide-crown' : 'i-lucide-user'"
                                  size="xs"
                                  :class="m.userId === w.ownerId ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'"
                                  :title="m.userId === w.ownerId ? $t('dashboard.workspaceRoleOwner') : $t('dashboard.workspaceRoleMember')"
                                />
                              </span>
                              <UButton
                                v-if="canRemoveWorkspaceMember(w, m)"
                                color="error"
                                size="xs"
                                class="absolute -right-1/6 top-1/4 rounded-full cursor-pointer"
                                icon="i-lucide-user-minus"
                                :title="$t('dashboard.workspaceMemberRemove')"
                                :aria-label="$t('dashboard.workspaceMemberRemove')"
                                @click="removeWorkspaceMember(w, m)"
                              />
                            </span>
                            <img
                              v-if="memberAvatarUrl(m)"
                              :src="memberAvatarUrl(m) || ''"
                              alt=""
                              class="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-600"
                              @error="onMemberAvatarError(m.userId)"
                            >
                            <div
                              v-else
                              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ring-2 ring-slate-200 dark:ring-slate-600"
                              :class="memberAvatarGradient(m)"
                            >
                              {{ memberInitials(m) }}
                            </div>
                          </div>
                          <p class="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-tight text-slate-800 dark:text-slate-100">
                            {{ workspaceMemberLabel(m) }}
                          </p>
                          <UBadge
                            v-if="user?.id === m.userId"
                            color="neutral"
                            variant="subtle"
                            size="xs"
                            class="absolute bottom-2 left-1/2 -translate-x-1/2"
                          >
                            {{ $t('dashboard.workspaceYouBadge') }}
                          </UBadge>
                          
                        </div>
                      </div>
                    </div>
                    <p v-else class="mb-3 text-xs text-slate-500 dark:text-slate-400">
                      {{ $t('dashboard.workspaceMembersEmpty') }}
                    </p>
                  </template>
                  <div class="flex items-center gap-1">
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
            </div>
            <div v-if="memberWorkspaces.length" class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ tf('dashboard.workspaceMembersSection', 'Member workspaces') }}
              </p>
              <ul class="grid gap-3 sm:grid-cols-2">
                <li
                  v-for="w in memberWorkspaces"
                  :key="w.id"
                  class="rounded-xl border px-4 py-4 transition"
                  :class="[
                    selectedWorkspaceId === w.id
                      ? 'border-primary-400 bg-primary-50/60 dark:border-primary-500 dark:bg-primary-950/30'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                  ]"
                >
                  <button type="button" class="mb-2 w-full text-left" @click="selectWorkspace(w.id)">
                    <p class="font-semibold text-slate-900 dark:text-white">{{ w.name }}</p>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ tf('dashboard.workspaceRoleMember', 'Member') }}</p>
                  </button>
                  <div v-if="w.members === undefined" class="mb-2 text-xs text-slate-500 dark:text-slate-400">
                    {{ $t('dashboard.workspaceMembersLoading') }}
                  </div>
                  <template v-else>
                    <p class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {{ $t('dashboard.workspaceMembersTitle') }}
                    </p>
                    <div
                      v-if="w.members.length"
                      class="max-h-56 overflow-y-auto"
                    >
                      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div
                          v-for="m in w.members"
                          :key="`${m.id}-${m.userId}`"
                          class="relative rounded-xl border border-slate-200 bg-slate-50/90 px-2 pb-7 pt-6 text-center dark:border-slate-700 dark:bg-slate-900/50"
                        >
                          <div class="relative mx-auto mb-2 w-fit">
                            <span
                              class="absolute left-1/2 top-0 z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white dark:bg-slate-900 dark:ring-slate-800"
                            >
                              <UIcon
                                :name="m.userId === w.ownerId ? 'i-lucide-crown' : 'i-lucide-user'"
                                class="size-3.5"
                                :class="m.userId === w.ownerId ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'"
                                :title="m.userId === w.ownerId ? $t('dashboard.workspaceRoleOwner') : $t('dashboard.workspaceRoleMember')"
                              />
                            </span>
                            <img
                              v-if="memberAvatarUrl(m)"
                              :src="memberAvatarUrl(m) || ''"
                              alt=""
                              class="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-600"
                              @error="onMemberAvatarError(m.userId)"
                            >
                            <div
                              v-else
                              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ring-2 ring-slate-200 dark:ring-slate-600"
                              :class="memberAvatarGradient(m)"
                            >
                              {{ memberInitials(m) }}
                            </div>
                          </div>
                          <p class="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-tight text-slate-800 dark:text-slate-100">
                            {{ workspaceMemberLabel(m) }}
                          </p>
                          <UBadge
                            v-if="user?.id === m.userId"
                            color="neutral"
                            variant="subtle"
                            size="xs"
                            class="absolute bottom-2 left-1/2 -translate-x-1/2"
                          >
                            {{ $t('dashboard.workspaceYouBadge') }}
                          </UBadge>
                        </div>
                      </div>
                    </div>
                    <p v-else class="text-xs text-slate-500 dark:text-slate-400">
                      {{ $t('dashboard.workspaceMembersEmpty') }}
                    </p>
                  </template>
                </li>
              </ul>
            </div>
          </div>
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
              <p v-if="selectedWorkspaceName" class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ selectedWorkspaceName }}
              </p>
            </div>
          </template>

          <div class="space-y-4">
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
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 items-start gap-3">
                    <img
                      v-if="clientAvatarUrl(client)"
                      :src="clientAvatarUrl(client) || ''"
                      alt=""
                      class="h-9 w-9 shrink-0 rounded-full object-cover"
                      @error="onClientAvatarError(client.id)"
                    >
                    <div
                      v-else
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white"
                      :class="clientAvatarGradient(client)"
                    >
                      {{ clientInitials(client) }}
                    </div>
                    <div class="min-w-0">
                    <p class="font-medium text-slate-900 dark:text-slate-100">
                      {{ client.firstName || client.username || client.telegramId }}
                    </p>
                    <p v-if="client.username" class="text-xs text-slate-500 dark:text-slate-400">
                      @{{ client.username }}
                    </p>
                    <p v-if="client.createdAt" class="text-xs text-slate-500 dark:text-slate-400">
                      {{ $t('dashboard.connectedAt') }}: {{ formatDate(client.createdAt) }}
                    </p>
                    </div>
                  </div>
                  <UButton
                    color="error"
                    variant="ghost"
                    size="xs"
                    square
                    class="shrink-0 rounded-full"
                    icon="i-lucide-trash-2"
                    :title="$t('dashboard.deleteClient')"
                    :aria-label="$t('dashboard.deleteClient')"
                    @click="deleteClient(client.id)"
                  />
                </div>
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
            <p v-else-if="inviteQueryNormalized.length > 0 && !inviteHits.length" class="text-xs text-slate-500">
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
              <UButton color="neutral" variant="ghost" class="rounded-full cursor-pointer" @click="createOpen = false">
                {{ $t('dashboard.workspaceCancel') }}
              </UButton>
              <UButton color="primary" class="rounded-full cursor-pointer" @click="saveCreate">
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
