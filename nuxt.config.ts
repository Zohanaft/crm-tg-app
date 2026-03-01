export default defineNuxtConfig({
  compatibilityDate: '2025-02-16',
  devtools: { enabled: true },
  srcDir: 'app',
  runtimeConfig: {
    /** Backend base URL for server-side API calls (e.g. https://zohanafttcrm.com or http://crm-tg-app-backend:3000). Leave empty when not needed. */
    apiBase: process.env.NUXT_API_BASE || '',
    /** Path prefix when apiBase is the same origin (e.g. '/api'). Set to '/api' for https://zohanafttcrm.com so nginx can proxy. Leave empty when apiBase is direct backend URL. */
    apiPathPrefix: process.env.NUXT_API_PATH_PREFIX || '',
  },
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