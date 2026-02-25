<template>
  <div id="telegram-login-widget-root" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import type { ITelegramAuthUser } from '~/types/telegram-session'
import { fetchSession } from '~/composables/useTelegramSession'

const props = withDefaults(
  defineProps<{
    telegramLogin: string
    mode?: string
    redirectUrl?: string
    requestAccess?: string
    size?: string
    userpic?: boolean
    radius?: string
  }>(),
  {
    mode: 'callback',
    redirectUrl: '',
    requestAccess: 'read',
    size: 'medium',
    userpic: true,
    radius: '0'
  }
)

const emit = defineEmits<{
  callback: [payload: ITelegramAuthUser]
  loaded: []
}>()

const userCookie = useCookie('tg_user', {
  maxAge: 60 * 60 * 24,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
})

function setCookie(payload: ITelegramAuthUser) {
  userCookie.value = btoa(
    String.fromCharCode(
      ...new TextEncoder().encode(JSON.stringify(payload))
    )
  )
}

const toast = useToast()
const { t } = useI18n()

async function onTelegramAuth(payload: ITelegramAuthUser) {
  setCookie(payload)
  try {
    await $fetch('/api/login', {
      method: 'POST',
      body: {
        id: payload.id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        username: payload.username,
        photo_url: payload.photo_url,
        auth_date: payload.auth_date,
        hash: payload.hash
      },
      credentials: 'include'
    })
    await fetchSession()
  } catch (e: unknown) {
    const err = e as { data?: { statusCode?: number }; statusCode?: number; response?: { status?: number } }
    const statusCode = err?.data?.statusCode ?? err?.statusCode ?? err?.response?.status
    if (statusCode === 500) {
      toast.add({
        title: 'Ошибка',
        description: t('login.serviceUnavailable'),
        color: 'error'
      })
    }
    console.error('Login failed:', e)
  }
  emit('callback', payload)
}

onMounted(() => {
  if (import.meta.client) {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?3'
    script.setAttribute('data-telegram-login', props.telegramLogin)
    script.setAttribute('data-request-access', props.requestAccess)
    script.setAttribute('data-size', props.size)
    script.setAttribute('data-userpic', String(props.userpic))
    if (props.radius) script.setAttribute('data-radius', props.radius)

    if (props.mode === 'callback') {
      ;(window as unknown as { onTelegramAuth: typeof onTelegramAuth }).onTelegramAuth = onTelegramAuth
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    } else {
      script.setAttribute('data-auth-url', props.redirectUrl)
    }

    document.querySelector('#telegram-login-widget-root')?.appendChild(script)
    emit('loaded')
  }
})
</script>
