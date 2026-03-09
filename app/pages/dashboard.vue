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
      <div v-else class="space-y-4">
        <UCard
          v-for="bot in botsStore.bots"
          :key="bot.id"
          class="overflow-hidden"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <span class="font-semibold">{{ bot.firstName ?? bot.username ?? bot.botId }}</span>
                <span v-if="bot.username" class="ml-2 text-muted-foreground">@{{ bot.username }}</span>
              </div>
              <span class="text-sm text-muted-foreground">ID: {{ bot.botId }}</span>
            </div>
          </template>

          <dl class="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground">ID (internal)</dt>
              <dd class="font-mono">{{ bot.id }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Bot ID</dt>
              <dd>{{ bot.botId }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">First name</dt>
              <dd>{{ bot.firstName ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Username</dt>
              <dd>{{ bot.username ? `@${bot.username}` : '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Is bot</dt>
              <dd>{{ bot.isBot ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Can join groups</dt>
              <dd>{{ bot.canJoinGroups ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Can read all group messages</dt>
              <dd>{{ bot.canReadAllGroupMessages ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Supports inline queries</dt>
              <dd>{{ bot.supportsInlineQueries ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Created</dt>
              <dd>{{ bot.createdAt }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Updated</dt>
              <dd>{{ bot.updatedAt }}</dd>
            </div>
          </dl>

          <details v-if="bot.rawData && Object.keys(bot.rawData).length" class="mt-4 text-sm">
            <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
              Raw data ({{ Object.keys(bot.rawData).length }} fields)
            </summary>
            <pre class="mt-2 max-h-40 overflow-auto rounded bg-muted p-3 text-xs">{{ JSON.stringify(bot.rawData, null, 2) }}</pre>
          </details>
        </UCard>
      </div>
    </section>
  </div>
</template>
