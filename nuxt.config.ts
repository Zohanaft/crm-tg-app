export default defineNuxtConfig({
  compatibilityDate: '2025-02-16',
  devtools: { enabled: true },
  srcDir: 'app',
  devServer: {
    host: process.env.DOCKER ? '0.0.0.0' : '127.0.0.1',
    port: process.env.DOCKER ? 3001 : 3000,
  },
  routeRules: {
    '/site.webmanifest': {
      headers: { 'Content-Type': 'application/manifest+json' },
    },
  },
  vite: {
    server: {
      allowedHosts: ['zohanafttcrm.com', 'dev.zohanafttcrm.com', '.zohanafttcrm.com'],
    },
  },
  css: [
    '~/assets/css/main.css',
  ],
  runtimeConfig: {},
  app: {
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon_light/favicon.svg',
        },
        {
          rel: 'manifest',
          type: 'application/manifest+json',
          href: '/site.webmanifest',
        },
      ],
    },
  },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/i18n', '@vueuse/nuxt'],
  i18n: {
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        file: 'en.json',
      },
      {
        code: 'ru',
        language: 'ru-RU',
        name: 'Русский',
        file: 'ru.json',
      },
    ],
    langDir: 'locales',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'no prefix',
      alwaysRedirect: false,
    },
  },
})