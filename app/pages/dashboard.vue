<script setup lang="ts">
definePageMeta({
  middleware: 'auth-private',
})

const userStore = useUserStore()
const user = computed(() => userStore.user)
const botsStore = useBotsStore()

await useAsyncData('bots', () => botsStore.fetchBots({ page: 1, limit: 20 }))
</script>

<template>
  <div class="container mx-auto p-8">
    <h1 class="mb-4 text-3xl font-bold">
      {{ $t('dashboard.title', 'Dashboard') }}
    </h1>
    <p v-if="user" class="mb-6 text-muted-foreground">
      {{ $t('dashboard.welcome', 'Welcome') }}, {{ user.firstName ?? user.username ?? 'User' }}
    </p>

    <div class="mb-6 flex flex-wrap gap-3">
      <UButton to="/connect-bot" variant="outline" :label="$t('dashboard.connectBot')" />
    </div>

    <section>
      <h2 class="mb-4 text-xl font-semibold">
        {{ $t('dashboard.botsList') }}
      </h2>
      <p v-if="botsStore.pending" class="text-muted-foreground">
        {{ $t('dashboard.botsLoading', 'Loading...') }}
      </p>
      <p v-else-if="botsStore.error" class="text-red-600">
        {{ $t('dashboard.botsError') }}
      </p>
      <p v-else-if="botsStore.isEmpty" class="text-muted-foreground">
        {{ $t('dashboard.botsEmpty') }}
      </p>
      <ul v-else class="divide-y divide-gray-200 dark:divide-gray-800">
        <li
          v-for="bot in botsStore.bots"
          :key="bot.id"
          class="flex items-center justify-between py-3"
        >
          <div>
            <span class="font-medium">{{ bot.firstName ?? bot.username ?? bot.botId }}</span>
            <span v-if="bot.username" class="ml-2 text-muted-foreground">@{{ bot.username }}</span>
          </div>
          <span class="text-sm text-muted-foreground">ID: {{ bot.botId }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
