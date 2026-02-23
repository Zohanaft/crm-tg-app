export default defineNuxtConfig({
  compatibilityDate: '2025-02-16',
  devtools: { enabled: true },
  srcDir: 'app',
  devServer: {
    host: '127.0.0.1',
    port: 3000
  },
  vite: {
    server: {
      allowedHosts: ['zohanafttcrm.com', 'dev.zohanafttcrm.com', '.zohanafttcrm.com'],
    }
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
          href: '/site.webmanifest',
        },
      ],
    },
  },
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@vueuse/nuxt',
  ],
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
