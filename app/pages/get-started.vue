<script setup lang="ts">
definePageMeta({
  middleware: 'auth-public',
})
</script>

<template>
  <div class="container mx-auto p-8">
    <h1 class="mb-4 text-3xl font-bold">
      {{ $t('getStarted.title', 'Как начать') }}
    </h1>
    <p class="mb-6 text-muted-foreground">
      {{ $t('getStarted.description', 'Инструкция по началу работы с CRM.') }}
    </p>
    <div class="prose dark:prose-invert max-w-none">
      <p>{{ $t('getStarted.content', 'Содержимое страницы будет добавлено.') }}</p>
    </div>
  </div>
</template>
