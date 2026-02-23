<script setup lang="ts">
// With ui.colorMode: false, useColorMode() is a stub with no .value; use fixed light theme
const isDark = false

const faviconHref = computed(
  () => `/favicon_${isDark ? 'dark' : 'light'}/favicon.svg`,
)

const themeColor = computed(() =>
  isDark ? '#18181b' : '#fafafa',
)

useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: faviconHref,
    },
  ],
  meta: [
    {
      name: 'theme-color',
      content: themeColor,
    },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
