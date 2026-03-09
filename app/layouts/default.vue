<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />

    <div class="flex flex-1">
      <AppSidebar  v-if="userStore.loggedIn" />

      <main class="flex-1 min-w-0">
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