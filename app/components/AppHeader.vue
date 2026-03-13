<script setup lang="ts">
const userStore = useUserStore()
const { logout } = useLogout()
</script>

<template>
  <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    <div class="container mx-auto flex h-14 items-center justify-between px-4">
      
      <NuxtLink to="/" class="mr-4 flex shrink-0 items-center">
        <img src="/images/logo.svg" alt="Logo" class="h-9 w-auto" />
      </NuxtLink>
      
      <nav class="flex items-start gap-4">
        <NuxtLink to="/get-started" class="text-sm hover:underline">
          {{ $t('nav.getStarted', 'Как начать') }}
        </NuxtLink>
        <NuxtLink to="/news" class="text-sm hover:underline">
          {{ $t('nav.news', 'Что нового') }}
        </NuxtLink>
      </nav>

      <nav class="flex items-center gap-4">
        <UColorModeButton />

        <template v-if="userStore.loggedIn">
          <NuxtLink to="/profile" class="text-sm hover:underline">
            {{ $t('nav.profile') }}
          </NuxtLink>
          <UButton variant="ghost" size="sm" @click="logout">
            {{ $t('nav.logout') }}
          </UButton>
        </template>
        <template v-else>
          <NuxtLink to="/sign-in" class="text-sm hover:underline">
            {{ $t('nav.signIn') }}
          </NuxtLink>
          <NuxtLink to="/sign-up" class="text-sm hover:underline">
            {{ $t('nav.signUp') }}
          </NuxtLink>
        </template>
      </nav>
    </div>
  </header>
</template>
