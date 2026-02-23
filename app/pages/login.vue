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
  // TODO: проверка hash и редирект на бэк
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const details = user.username ? `@${user.username}` : `ID: ${user.id}`
  toast.add({
    title: 'Telegram Auth',
    description: `Logged in as ${displayName} (${details})`,
    color: 'success'
  })
  console.log('Telegram auth:', user)
}

onMounted(() => {
  ;(window as unknown as { onTelegramAuth?: typeof onTelegramAuth }).onTelegramAuth = onTelegramAuth

  const container = document.getElementById('telegram-login-widget')
  if (container) {
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'T_CRMAuth_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    container.appendChild(script)
  }
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
          <div
            id="telegram-login-widget"
            class="min-h-[44px]"
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
