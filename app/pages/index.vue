<template>
  <div class="container mx-auto p-8">
    <h1 class="mb-4 text-3xl font-bold">
      {{ $t('welcome') }}
    </h1>
    <p class="mb-6 text-muted-foreground">
      {{ $t('description') }}
    </p>
    <NuxtLink to="/login">
      <UButton>
        {{ $t('login.title') }}
      </UButton>
    </NuxtLink>
  </div>
</template>
