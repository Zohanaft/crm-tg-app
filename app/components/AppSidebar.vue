<script setup lang="ts">
const links = computed(() => [{ to: '/dashboard', label: 'dashboard.title' }])
</script>

<template>
  <aside
    class="w-56 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
  >
    <nav class="flex flex-col gap-1 p-3">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
        active-class="!bg-blue-100 !text-blue-800 dark:!bg-blue-950/50 dark:!text-blue-200"
      >
        {{ $t(link.label) }}
      </NuxtLink>
    </nav>
  </aside>
</template>
