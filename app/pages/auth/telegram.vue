<script setup lang="ts">
const route = useRoute()

onMounted(async () => {
  const id = route.query.id
  const hash = route.query.hash
  if (!id || !hash) {
    navigateTo('/login')
    return
  }
  try {
    const data = await useApiFetch<{ ok: boolean; user: import('~/stores/user').IUser }>('/api/login', {
      method: 'POST',
      body: {
        id: Number(id),
        first_name: route.query.first_name,
        last_name: route.query.last_name,
        username: route.query.username,
        photo_url: route.query.photo_url,
        auth_date: Number(route.query.auth_date),
        hash,
      },
      credentials: 'include',
    })
    if (data?.user) {
      useUserStore().setUser(data.user)
      navigateTo('/dashboard')
      return
    }
  } catch (e) {
    console.error('Telegram auth failed:', e)
  }
  navigateTo('/login')
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <p class="text-muted-foreground">{{ $t('login.loadingTelegram') }}</p>
  </div>
</template>
