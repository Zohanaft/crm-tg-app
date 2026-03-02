<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-between h-14 px-4 sm:px-6">
        <NuxtLink to="/" class="font-semibold text-lg">
          CRM
        </NuxtLink>

        <nav class="flex items-center gap-2">
          <UColorModeButton />
          <UButton
            v-if="!userStore.loggedIn"
            variant="ghost"
            :label="$t('nav.signIn')"
            to="/sign-in"
          />
          <UButton
            variant="outline"
            :label="$t('nav.signUp')"
            to="/sign-up"
          />
          <UButton
            v-if="userStore.loggedIn"
            variant="outline"
            :label="$t('nav.profile')"
            to="/profile"
          />
          <UButton
          v-if="userStore.loggedIn"
          color="error"
            variant="outline"
            :label="$t('nav.logout')"
            @click="logout"
          />
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const userStore = useUserStore()
const { logout } = useLogout()
</script>
