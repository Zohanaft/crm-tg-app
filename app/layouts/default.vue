<template>
  <div class="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <AppHeader />

    <div class="flex min-h-0 flex-1">
      <AppSidebar v-if="userStore.loggedIn" />

      <main class="min-w-0 flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/AppHeader.vue'
import AppSidebar from '~/components/AppSidebar.vue'

const userStore = useUserStore()
</script>