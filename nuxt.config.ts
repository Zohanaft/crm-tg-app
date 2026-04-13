export default defineNuxtConfig({
  compatibilityDate: '2025-02-16',
  devtools: { enabled: true },
  srcDir: 'app',
  build: {
    transpile: ['@nuxt/ui'],
  },
  runtimeConfig: {
    /** Backend base URL for server-side API calls (e.g. https://devtbookflow.nl.tuna.am or http://crm-tg-app-backend:3000). Leave empty when not needed. */
    apiBase: process.env.NUXT_API_BASE || '',
    /** Path prefix when apiBase is the same origin (e.g. '/api'). Set to '/api' for https://devtbookflow.nl.tuna.am so nginx can proxy. Leave empty when apiBase is direct backend URL. */
    apiPathPrefix: process.env.NUXT_API_PATH_PREFIX || '',
    public: {
      apiPathPrefix: process.env.NUXT_API_PATH_PREFIX || '/api',
      wssPath: process.env.NUXT_WSS_PATH || '/api/wss',
      /** SW отключён по умолчанию (ломал редиректы логина / Telegram). Включить: NUXT_PUBLIC_SERVICE_WORKER_ENABLED=true */
      serviceWorkerEnabled: process.env.NUXT_PUBLIC_SERVICE_WORKER_ENABLED === 'true',
    },
  },
  devServer: {
    host: process.env.DOCKER ? '0.0.0.0' : '127.0.0.1',
    port: process.env.DOCKER ? 3001 : 3000,
  },
  routeRules: {
    '/site.webmanifest': {
      headers: { 'Content-Type': 'application/json' },
    },
  },
  vite: {
    server: {
      allowedHosts: ['devtbookflow.nl.tuna.am'],
    },
    optimizeDeps: {
      // Fewer parallel /@fs/reka-ui/dist/* requests through tuna/nginx (502 under HTTP/2 burst).
      include: ['@nuxt/ui', 'reka-ui'],
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
  icon: {
    /**
     * `server` тянет коллекции через require(@iconify-json/*) в Nitro — в Docker том
     * `crm-tg-app-node-modules` часто без lucide → MODULE_NOT_FOUND на `/_nuxt_icon/...`.
     * `iconify` — загрузка с api.iconify.design (клиент/SSR по HTTP), локальный JSON не нужен.
     */
    provider: 'iconify',
    /**
     * Если снова включишь provider `server`, не оставляй дефолт `/api/_nuxt_icon` за nginx на Nest.
     */
    localApiEndpoint: '/_nuxt_icon',
  },
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