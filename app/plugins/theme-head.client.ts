export default defineNuxtPlugin(() => {
  const colorMode = useColorMode()

  const faviconHref = computed(
    () => `/favicon_${colorMode.value === 'dark' ? 'dark' : 'light'}/favicon.svg`,
  )

  const themeColor = computed(() =>
    colorMode.value === 'dark' ? '#18181b' : '#fafafa',
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
})
