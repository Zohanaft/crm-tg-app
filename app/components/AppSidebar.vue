<script setup lang="ts">
const links = computed(() => [
  { to: '/dashboard', label: 'dashboard.title' },
])
</script>

<template>
  <aside class="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
    <nav class="flex flex-col gap-1 p-4">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="rounded-md px-3 py-2 text-sm hover:bg-gray-200 dark:hover:bg-gray-800"
        active-class="bg-gray-200 dark:bg-gray-800 font-medium"
      >
        {{ $t(link.label) }}
      </NuxtLink>
    </nav>
  </aside>
</template>
