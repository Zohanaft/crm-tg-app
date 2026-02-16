<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <h1 class="text-2xl font-bold">{{ error?.statusCode ?? 500 }}</h1>
    <p class="text-muted-foreground">{{ error?.message ?? 'An error occurred' }}</p>
    <UButton @click="handleError">Go back</UButton>
  </div>
</template>

<script setup lang="ts">
const error = useError()

const handleError = () => clearError({ redirect: '/' })
</script>
