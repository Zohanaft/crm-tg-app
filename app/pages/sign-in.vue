<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ITelegramAuthUser } from '~/types/telegram-session'

const signInFormSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
})

type SignInFormState = v.InferOutput<typeof signInFormSchema>

const state = reactive<SignInFormState>({
  email: '',
  password: ''
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<SignInFormState>) {
  try {
    // TODO: интеграция с бэкендом (login)
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
        description: $t('signIn.serviceUnavailable'),
        color: 'error'
      })
    }
  }
}

const userStore = useUserStore()

const onTelegramAuth = (_user: ITelegramAuthUser) => {
  if (userStore.user) {
    toast.add({
      title: 'Telegram Auth',
      description: $t('signIn.success', 'Вы успешно вошли'),
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

const TG_BOT_ID = ref<number>(8093778475)

const loginViaTelegram = () => {
  const botId = TG_BOT_ID.value
  const redirectUrl = encodeURIComponent(window.location.origin + '/auth/telegram')

  window.location.href =
    `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${window.location.origin}&return_to=${redirectUrl}`
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h2 class="text-xl font-semibold">
          {{ $t('signIn.title') }}
        </h2>
      </template>

      <UForm :schema="signInFormSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('signIn.email')" name="email">
          <UInput
            v-model="state.email"
            class="w-full"
            type="email"
            :placeholder="$t('signIn.emailPlaceholder')"
            autocomplete="email"
            disabled
          />
        </UFormField>

        <UFormField class="mb-8" :label="$t('signIn.password')" name="password">
          <UInput
            v-model="state.password"
            class="w-full"
            type="password"
            :placeholder="$t('signIn.passwordPlaceholder')"
            autocomplete="current-password"
            disabled
          />
        </UFormField>

        <UButton type="submit" block size="lg" disabled>
          {{ $t('signIn.submit') }}
        </UButton>
      </UForm>

      <USeparator :label="$t('signIn.orContinueWith')" class="my-6" />

      <UButton block size="lg" @click="loginViaTelegram">
        {{ $t('signIn.telegram') }}
      </UButton>
    </UCard>
  </div>
</template>
