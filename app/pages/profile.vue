<script setup lang="ts">
const userStore = useUserStore()

definePageMeta({
  middleware: ['auth-private'],
})
</script>

<template>
  <div class="mx-auto max-w-2xl p-4 sm:p-6">
    <UCard class="border-slate-200 shadow-sm dark:border-slate-800">
      <template #header>
        <h1 class="text-xl font-semibold text-slate-900 dark:text-white">
          {{ $t('profile.title') }}
        </h1>
      </template>

      <div v-if="userStore.user" class="space-y-4">
        <div class="flex items-center gap-4">
          <UAvatar
            v-if="userStore.user.photoUrl"
            :src="userStore.user.photoUrl"
            size="lg"
            alt="Avatar"
          />
          <UAvatar
            v-else
            :text="[userStore.user.firstName, userStore.user.lastName].filter(Boolean).join(' ') || userStore.user.username || '?'"
            size="lg"
          />
          <div>
            <p class="font-medium text-slate-900 dark:text-white">
              {{ [userStore.user.firstName, userStore.user.lastName].filter(Boolean).join(' ') || userStore.user.username || '—' }}
            </p>
            <p v-if="userStore.user.username" class="text-sm text-slate-500 dark:text-slate-400">
              @{{ userStore.user.username }}
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Telegram ID: {{ userStore.user.telegramId }}
            </p>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
