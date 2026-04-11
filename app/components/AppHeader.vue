<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onClickOutside } from '@vueuse/core'
import type { WorkspaceInvitePending } from '~/composables/useWorkspaceInvitesApi'
import { formatActionTypeLabel } from '~/stores/actions'

const userStore = useUserStore()
const { loggedIn } = storeToRefs(userStore)
const actionsStore = useActionsStore()
const wsStore = useWorkspacesStore()
const { listPending, accept: acceptInviteRequest } = useWorkspaceInvitesApi()
const toast = useToast()
const { logout } = useLogout()
const { t, locale, setLocale, locales } = useI18n()
const localeOptions = computed(() =>
  (locales.value as { code: string; name: string }[]).map((l) => ({
    label: l.name,
    value: l.code,
  })),
)
const currentLocaleName = computed(
  () => localeOptions.value.find((o) => o.value === locale.value)?.label ?? 'EN',
)
function onLocaleSelect(value: string) {
  if (value === 'en' || value === 'ru') setLocale(value)
}

const displayName = computed(() => {
  const u = userStore.user
  if (!u) return ''
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'User'
})

const userMenuItems = computed(() => [
  [
    {
      label: t('nav.profile'),
      to: '/profile',
    },
    {
      label: t('nav.logout'),
      onClick: () => logout(),
      color: 'error' as const,
    },
  ],
])

const pendingInvites = ref<WorkspaceInvitePending[]>([])
const notifPanelOpen = ref(false)
const notifPanelRef = ref<HTMLElement | null>(null)

onClickOutside(notifPanelRef, () => {
  notifPanelOpen.value = false
})

async function refreshNotifications() {
  if (!loggedIn.value) return
  await Promise.all([
    actionsStore.fetchAll(),
    listPending()
      .then((r) => {
        pendingInvites.value = r
      })
      .catch(() => {
        pendingInvites.value = []
      }),
  ])
}

watch(
  loggedIn,
  (v) => {
    if (v) void refreshNotifications()
    else {
      pendingInvites.value = []
      actionsStore.clear()
      notifPanelOpen.value = false
    }
  },
  { immediate: true },
)

const notifBadgeCount = computed(
  () => actionsStore.unreadCount + pendingInvites.value.length,
)

function toggleNotifPanel() {
  notifPanelOpen.value = !notifPanelOpen.value
  if (notifPanelOpen.value) {
    void refreshNotifications()
  }
}

function markNotificationRead(actionId: string) {
  void actionsStore.markRead(actionId)
}

async function onAcceptInvite(inviteId: string) {
  try {
    const result = await acceptInviteRequest(inviteId)
    toast.add({ title: t('notifications.inviteAccepted'), color: 'success' })
    await wsStore.fetchMy().catch(() => {})
    if (result?.workspaceId) {
      await wsStore.fetchMembers(result.workspaceId).catch(() => {})
    }
    await refreshNotifications()
  } catch {
    toast.add({ title: t('dashboard.workspaceInviteError'), color: 'error' })
  }
}

function formatNotifyTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95"
  >
    <div class="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
      <NuxtLink to="/" class="flex shrink-0 items-center">
        <img src="/images/logo.svg" alt="Logo" class="h-[2rem] w-auto" />
      </NuxtLink>

      <nav class="hidden items-center gap-1 sm:flex">
        <NuxtLink
          to="/get-started"
          class="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
        >
          {{ $t('nav.getStarted') }}
        </NuxtLink>
        <NuxtLink
          to="/news"
          class="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
        >
          {{ $t('nav.news') }}
        </NuxtLink>
      </nav>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <UColorModeButton class="rounded-full" />
        <UDropdownMenu
          :items="[
            localeOptions.map((opt) => ({
              label: opt.label,
              onClick: () => onLocaleSelect(opt.value),
            })),
          ]"
        >
          <UButton variant="ghost" size="md" color="neutral" class="rounded-full" trailing-icon="i-lucide-chevron-down">
            {{ currentLocaleName }}
          </UButton>
        </UDropdownMenu>

        <template v-if="userStore.loggedIn">
          <div ref="notifPanelRef" class="relative">
            <UButton
              variant="ghost"
              color="neutral"
              size="md"
              class="relative rounded-full"
              :aria-label="$t('nav.notifications')"
              icon="i-lucide-bell"
              @click="toggleNotifPanel"
            />
            <span
              v-if="notifBadgeCount > 0"
              class="absolute right-0.5 top-0.5 min-h-[1rem] min-w-[1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white"
            >
              {{ notifBadgeCount > 99 ? '99+' : notifBadgeCount }}
            </span>
            <div
              v-if="notifPanelOpen"
              class="absolute right-0 z-50 mt-2 max-h-[min(70vh,420px)] w-[min(calc(100vw-2rem),360px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <div class="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ $t('notifications.title') }}</p>
              </div>
              <div class="max-h-[min(60vh,340px)] overflow-y-auto p-3">
                <template v-if="pendingInvites.length">
                  <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {{ $t('notifications.invitesTitle') }}
                  </p>
                  <ul class="mb-4 space-y-2">
                    <li
                      v-for="inv in pendingInvites"
                      :key="inv.id"
                      class="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <p class="text-sm font-medium text-slate-900 dark:text-white">{{ inv.workspace.name }}</p>
                      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {{ inv.invitedBy.firstName ?? inv.invitedBy.username ?? 'User' }}
                      </p>
                      <UButton size="xs" color="primary" class="mt-2 rounded-full" @click="onAcceptInvite(inv.id)">
                        {{ $t('notifications.acceptInvite') }}
                      </UButton>
                    </li>
                  </ul>
                </template>
                <template v-if="!actionsStore.items.length && !pendingInvites.length">
                  <p class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {{ $t('notifications.empty') }}
                  </p>
                </template>
                <ul v-if="actionsStore.items.length" class="space-y-2">
                  <li
                    v-for="a in actionsStore.items.slice(0, 40)"
                    :key="a.id"
                    class="rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                    :class="!a.readAt ? 'bg-slate-50/60 dark:bg-slate-800/40' : ''"
                  >
                    <p class="text-xs font-medium text-primary-600 dark:text-primary-400">
                      {{ formatActionTypeLabel(a.type) }}
                    </p>
                    <p class="text-sm text-slate-800 dark:text-slate-200">{{ a.title }}</p>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {{ formatNotifyTime(a.createdAt) }}
                    </p>
                    <div v-if="!a.readAt" class="mt-2">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="outline"
                        class="rounded-full"
                        @click="markNotificationRead(a.id)"
                      >
                        {{ $t('notifications.markRead') }}
                      </UButton>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <UDropdownMenu :items="userMenuItems">
            <UButton variant="ghost" size="md" color="neutral" class="gap-2 rounded-full">
              <UAvatar
                v-if="userStore.user?.photoUrl"
                :src="userStore.user.photoUrl"
                size="sm"
                alt=""
              />
              <UAvatar v-else :text="displayName" size="md" />
              <span class="hidden max-w-24 truncate text-left text-sm font-medium text-slate-700 dark:text-slate-300 sm:inline">
                {{ displayName }}
              </span>
              <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0" />
            </UButton>
          </UDropdownMenu>
        </template>
        <template v-else>
          <NuxtLink to="/sign-in">
            <UButton variant="ghost" size="sm" color="neutral" class="rounded-full">
              {{ $t('nav.signIn') }}
            </UButton>
          </NuxtLink>
          <NuxtLink to="/sign-up">
            <UButton variant="solid" color="primary" size="sm" class="rounded-full">
              {{ $t('nav.signUp') }}
            </UButton>
          </NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
