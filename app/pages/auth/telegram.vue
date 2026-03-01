<script setup lang="ts">
/**
 * Telegram OAuth redirect target.
 * Telegram sends the result in the URL hash (#tgAuthResult=...), which is not sent to the server.
 * This page reads the hash and redirects to the backend with tgAuthResult in the query string.
 */
onMounted(() => {
  if (!import.meta.client) return
  const hash = window.location.hash?.slice(1) || ''
  const params = new URLSearchParams(hash)
  const tgAuthResult = params.get('tgAuthResult')
  if (tgAuthResult) {
    const url = `${window.location.origin}/api/auth/telegram?tgAuthResult=${encodeURIComponent(tgAuthResult)}`
    window.location.replace(url)
  } else {
    navigateTo('/login')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <p class="text-muted-foreground">Redirecting...</p>
  </div>
</template>
