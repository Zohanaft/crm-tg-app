<script setup lang="ts">
const userStore = useUserStore()
const { logout } = useLogout()
</script>

<template>
  <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    <div class="container mx-auto flex h-14 items-center justify-between px-4">
      <NuxtLink to="/" class="font-semibold">
        {{ $t('description', 'CRM Telegram App') }}
      </NuxtLink>

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
