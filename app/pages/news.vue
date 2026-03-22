<script setup lang="ts">
definePageMeta({
  middleware: 'auth-public',
})
</script>

<template>
  <div class="mx-auto max-w-2xl p-4 sm:p-8">
    <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {{ $t('news.title', 'Что нового') }}
      </h1>
      <p class="mt-3 text-slate-600 dark:text-slate-400">
        {{ $t('news.description', 'Последние обновления и новости.') }}
      </p>
      <p class="mt-6 leading-relaxed text-slate-700 dark:text-slate-300">
        {{ $t('news.content', 'Содержимое страницы будет добавлено.') }}
      </p>
    </div>
  </div>
</template>
