<script setup lang="ts">
const userStore = useUserStore()
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
