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

const onTelegramAuth = (user: ITelegramAuthUser) => {
  console.log('Telegram auth:', user);
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const details = user.username ? `@${user.username}` : `ID: ${user.id}`
  toast.add({
    title: 'Telegram Auth',
    description: `Logged in as ${displayName} (${details})`,
    color: 'success'
  })
  // TODO: проверка hash и отправка на бэкенд
}

const TELEGRAM_BOT = ref<string>('T_CRMAuth_bot')

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

      <ClientOnly>
        <TelegramLoginWidget size="large" radius="30" :telegram-login="TELEGRAM_BOT" @callback="onTelegramAuth" />
        <template #fallback>
          <div class="min-h-[44px] flex items-center justify-center text-muted-foreground">
            {{ $t('login.loadingTelegram') }}
          </div>
        </template>
      </ClientOnly>
    </UCard>
  </div>
</template>
