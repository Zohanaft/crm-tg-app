<script setup lang="ts">
definePageMeta({
  middleware: 'auth-private',
})

const userStore = useUserStore()
const user = computed(() => userStore.user)
</script>

<template>
  <div class="container mx-auto p-8">
    <h1 class="mb-4 text-3xl font-bold">
      {{ $t('dashboard.title', 'Dashboard') }}
    </h1>
    <p v-if="user" class="mb-6 text-muted-foreground">
      {{ $t('dashboard.welcome', 'Welcome') }}, {{ user.firstName ?? user.username ?? 'User' }}
    </p>
  </div>
</template>
