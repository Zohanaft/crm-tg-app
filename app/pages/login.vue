<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ITelegramAuthUser } from '~/types/telegram-session'

const loginFormSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
})

type LoginFormState = v.InferOutput<typeof loginFormSchema>

const state = reactive<LoginFormState>({
  email: '',
  password: ''
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<LoginFormState>) {
  try {
    // TODO: интеграция с бэкендом
    toast.add({
      title: 'Success',
      description: `Logged in as ${event.data.email}`,
      color: 'success'
    })
  } catch (e: unknown) {
    const statusCode = (e as { data?: { statusCode?: number }; statusCode?: number })?.data?.statusCode
      ?? (e as { statusCode?: number })?.statusCode
    if (statusCode === 500) {
      toast.add({
        title: 'Ошибка',
        description: $t('login.serviceUnavailable'),
        color: 'error'
      })
    }
  }
}

const userStore = useUserStore()

const onTelegramAuth = (_user: ITelegramAuthUser) => {
  console.log('payload', _user)
  if (userStore.user) {
    toast.add({
      title: 'Telegram Auth',
      description: $t('login.success', 'Вы успешно вошли'),
      color: 'success'
    })
    navigateTo('/dashboard')
    return
  }
  const displayName = [_user.first_name, _user.last_name].filter(Boolean).join(' ')
  const details = _user.username ? `@${_user.username}` : `ID: ${_user.id}`
  toast.add({
    title: 'Telegram Auth',
    description: `Logged in as ${displayName} (${details})`,
    color: 'success'
  })
}

const TELEGRAM_BOT = ref<string>('T_CRMAuth_bot')
const TG_BOT_ID = ref<number>(8093778475);

const login = () => {
  const botId = TG_BOT_ID.value
  const redirectUrl = encodeURIComponent(window.location.origin + '/auth/telegram')

  console.log('redirectUrl', redirectUrl);

  window.location.href =
    `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${window.location.origin}&return_to=${redirectUrl}`
}

</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h2 class="text-xl font-semibold">
          {{ $t('login.title') }}
        </h2>
      </template>

      <UForm :schema="loginFormSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('login.email')" name="email">
          <UInput
            class="w-full"
            v-model="state.email"
            type="email"
            :placeholder="$t('login.emailPlaceholder')"
            autocomplete="email"
          />
        </UFormField>

        <UFormField class="mb-8" :label="$t('login.password')" name="password">
          <UInput
            class="w-full"
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

      <UButton type="submit" block size="lg" @click="login"> Войти через Telegram </UButton>
    </UCard>
  </div>
</template>
