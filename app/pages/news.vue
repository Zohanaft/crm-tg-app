<script setup lang="ts">
definePageMeta({
  middleware: 'auth-public',
})
</script>

<template>
  <div class="container mx-auto p-8">
    <h1 class="mb-4 text-3xl font-bold">
      {{ $t('news.title', 'Что нового') }}
    </h1>
    <p class="mb-6 text-muted-foreground">
      {{ $t('news.description', 'Последние обновления и новости.') }}
    </p>
    <div class="prose dark:prose-invert max-w-none">
      <p>{{ $t('news.content', 'Содержимое страницы будет добавлено.') }}</p>
    </div>
  </div>
</template>
