<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
})

type Schema = v.InferOutput<typeof schema>

const state = reactive<Schema>({
  email: '',
  password: ''
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  // TODO: интеграция с бэкендом
  toast.add({
    title: 'Success',
    description: `Logged in as ${event.data.email}`,
    color: 'success'
  })
  console.log('Login:', event.data)
}

function onTelegramAuth(user: {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}) {
  console.log('[TG AUTH] onTelegramAuth вызван, user:', user)
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const details = user.username ? `@${user.username}` : `ID: ${user.id}`
  toast.add({
    title: 'Telegram Auth',
    description: `Logged in as ${displayName} (${details})`,
    color: 'success'
  })
}

const TELEGRAM_BOT = 'T_CRMAuth_bot'

const telegramWidgetSrc = ref('')

function logAllMessages(e: MessageEvent) {
  console.log('[TG MSG RAW] любое postMessage:', e.origin, e.data)
}

function handleTelegramMessage(event: MessageEvent) {
  console.log('[TG MSG] postMessage получен:', { origin: event.origin, data: event.data, type: typeof event.data })
  const allowedOrigins = ['https://oauth.telegram.org', window.location.origin]
  if (!allowedOrigins.includes(event.origin)) {
    console.log('[TG MSG] отказ: origin не в списке', { got: event.origin, allowed: allowedOrigins })
    return
  }
  let data: Record<string, unknown> | null = null
  if (event.data != null && typeof event.data === 'object') {
    data = event.data as Record<string, unknown>
  } else if (typeof event.data === 'string') {
    try {
      data = JSON.parse(event.data) as Record<string, unknown>
      console.log('[TG MSG] data распарсен из строки:', data)
    } catch {
      console.log('[TG MSG] отказ: data строка не JSON', event.data?.slice?.(0, 100))
      return
    }
  }
  if (!data) {
    console.log('[TG MSG] отказ: data не объект и не строка', event.data)
    return
  }
  // Форматы: { event: 'auth_user', auth_data }, или { event: 'auth', user }, или { user: { ... } }, или { id, hash, ... }
  const authData = data.auth_data as Record<string, unknown> | undefined
  const userFromData = data.user as Record<string, unknown> | undefined
  const raw =
    (data.event === 'auth_user' && authData?.id != null && authData?.hash)
      ? authData
      : (data.event === 'auth' && userFromData)
        ? userFromData
        : (userFromData?.id != null && userFromData?.hash)
          ? userFromData
          : (data.id != null && data.hash)
            ? (data as Record<string, unknown>)
            : null
  if (!raw || typeof raw.hash !== 'string') {
    console.log('[TG MSG] отказ: нет raw или hash', { data, raw })
    return
  }
  console.log('[TG MSG] вызываем onTelegramAuth с raw:', raw)
  onTelegramAuth({
    id: Number(raw.id),
    first_name: String(raw.first_name ?? ''),
    last_name: raw.last_name != null ? String(raw.last_name) : undefined,
    username: raw.username != null ? String(raw.username) : undefined,
    photo_url: raw.photo_url != null ? String(raw.photo_url) : undefined,
    auth_date: Number(raw.auth_date ?? 0),
    hash: String(raw.hash),
  })
}

function decodeBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = base64.length % 4
  if (remainder === 2) base64 += '=='
  else if (remainder === 3) base64 += '='
  return atob(base64)
}

function parseTelegramParams(searchOrHash: string): Record<string, string> {
  const params: Record<string, string> = {}
  const str = searchOrHash.replace(/^[?#]/, '')
  str.split('&').forEach((p) => {
    const [k, v] = p.split('=')
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v)
  })
  return params
}

/** Извлекает данные Telegram из hash/query: либо tgAuthResult=<base64>, либо id=...&hash=... */
function getTelegramAuthFromUrl(): Record<string, string> | null {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
  const search = typeof window !== 'undefined' ? window.location.search.slice(1) : ''
  console.log('[TG URL] getTelegramAuthFromUrl вызван', { hash: hash.slice(0, 80) + (hash.length > 80 ? '...' : ''), search })
  if (hash.startsWith('tgAuthResult=')) {
    console.log('[TG URL] формат tgAuthResult (base64)')
    try {
      const base64 = decodeURIComponent(hash.replace('tgAuthResult=', '').split('&')[0] ?? '')
      const json = decodeBase64Url(base64)
      console.log('[TG URL] base64 декодирован, json строка:', json.slice(0, 120) + (json.length > 120 ? '...' : ''))
      const data = JSON.parse(json) as Record<string, unknown>
      console.log('[TG URL] распарсен data:', data)
      const out: Record<string, string> = {
        id: String(data.id),
        first_name: String(data.first_name ?? ''),
        auth_date: String(data.auth_date ?? 0),
        hash: String(data.hash),
      }
      if (data.last_name != null) out.last_name = String(data.last_name)
      if (data.username != null) out.username = String(data.username)
      if (data.photo_url != null) out.photo_url = String(data.photo_url)
      console.log('[TG URL] возвращаем out:', out)
      return out
    } catch (e) {
      console.log('[TG URL] ошибка парсинга tgAuthResult:', e)
      return null
    }
  }
  const hashParams = parseTelegramParams(hash)
  const queryParams = parseTelegramParams(search)
  console.log('[TG URL] hashParams:', hashParams, 'queryParams:', queryParams)
  if (hashParams.hash && hashParams.id) {
    console.log('[TG URL] возвращаем hashParams')
    return hashParams
  }
  if (queryParams.hash && queryParams.id) {
    console.log('[TG URL] возвращаем queryParams')
    return queryParams
  }
  console.log('[TG URL] ничего не найдено, null')
  return null
}

function applyTelegramAuth(params: Record<string, string>) {
  console.log('[TG APPLY] applyTelegramAuth вызван, params:', params)
  if (!params.hash || !params.id) {
    console.log('[TG APPLY] отказ: нет hash или id')
    return
  }
  console.log('[TG APPLY] вызываем onTelegramAuth')
  onTelegramAuth({
    id: Number(params.id),
    first_name: params.first_name ?? '',
    last_name: params.last_name,
    username: params.username,
    photo_url: params.photo_url,
    auth_date: Number(params.auth_date ?? 0),
    hash: params.hash,
  })
}

onMounted(() => {
  const isInIframe = window.self !== window.top
  console.log('[TG MOUNT] onMounted', {
    isInIframe,
    href: window.location.href,
    hash: window.location.hash,
    search: window.location.search,
    origin: window.location.origin,
  })
  const telegramParams = getTelegramAuthFromUrl()
  console.log('[TG MOUNT] telegramParams:', telegramParams)

  if (isInIframe && telegramParams) {
    const payload = {
      event: 'auth',
      user: {
        id: Number(telegramParams.id),
        first_name: telegramParams.first_name ?? '',
        last_name: telegramParams.last_name,
        username: telegramParams.username,
        photo_url: telegramParams.photo_url,
        auth_date: Number(telegramParams.auth_date ?? 0),
        hash: telegramParams.hash,
      },
    }
    console.log('[TG MOUNT] мы в iframe, шлём parent postMessage:', payload)
    window.parent.postMessage(payload, window.location.origin)
    return
  }

  if (telegramParams) {
    console.log('[TG MOUNT] мы в top, вызываем applyTelegramAuth')
    applyTelegramAuth(telegramParams)
    window.history.replaceState(null, '', window.location.pathname)
  }

  const origin = window.location.origin
  const returnTo = `${origin}/login`
  telegramWidgetSrc.value = `https://oauth.telegram.org/embed/${TELEGRAM_BOT}?origin=${encodeURIComponent(origin)}&return_to=${encodeURIComponent(returnTo)}&size=large&request_access=write`
  console.log('[TG MOUNT] вешаем listener на message')
  window.addEventListener('message', handleTelegramMessage)
  window.addEventListener('message', logAllMessages)
})

onUnmounted(() => {
  window.removeEventListener('message', handleTelegramMessage)
  window.removeEventListener('message', logAllMessages)
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h2 class="text-xl font-semibold">
          {{ $t('login.title') }}
        </h2>
      </template>

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('login.email')" name="email">
          <UInput
            v-model="state.email"
            type="email"
            :placeholder="$t('login.emailPlaceholder')"
            autocomplete="email"
          />
        </UFormField>

        <UFormField :label="$t('login.password')" name="password">
          <UInput
            v-model="state.password"
            type="password"
            :placeholder="$t('login.passwordPlaceholder')"
            autocomplete="current-password"
          />
        </UFormField>

        <UButton type="submit" block size="lg">
          {{ $t('login.submit') }}
        </UButton>
      </UForm>

      <USeparator :label="$t('login.orContinueWith')" class="my-6" />

      <div class="flex flex-col items-center gap-4">
        <ClientOnly>
          <iframe
            v-if="telegramWidgetSrc"
            :src="telegramWidgetSrc"
            class="min-h-[44px] max-h-[44px] w-[280px] border-0"
            title="Log in with Telegram"
          />
          <template #fallback>
            <div class="flex min-h-[44px] items-center justify-center text-muted-foreground">
              {{ $t('login.loadingTelegram') }}
            </div>
          </template>
        </ClientOnly>
      </div>
    </UCard>
  </div>
</template>
