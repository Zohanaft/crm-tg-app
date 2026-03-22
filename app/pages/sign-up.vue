<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

const signUpFormSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
})

type SignUpFormState = v.InferOutput<typeof signUpFormSchema>

const state = reactive<SignUpFormState>({
  email: '',
  password: ''
})

const toast = useToast()

const TG_BOT_ID = 8093778475

function registerViaTelegram() {
  const redirectUrl = encodeURIComponent(`${window.location.origin}/auth/telegram`)
  window.location.href =
    `https://oauth.telegram.org/auth?bot_id=${TG_BOT_ID}&origin=${window.location.origin}&return_to=${redirectUrl}`
}

async function onSubmit(event: FormSubmitEvent<SignUpFormState>) {
  try {
    // TODO: fetch sign-up (no server handling yet)
    toast.add({
      title: 'Success',
      description: `Registered as ${event.data.email}`,
      color: 'success'
    })
  } catch (e: unknown) {
    const statusCode = (e as { data?: { statusCode?: number }; statusCode?: number })?.data?.statusCode
      ?? (e as { statusCode?: number })?.statusCode
    if (statusCode === 500) {
      toast.add({
        title: 'Ошибка',
        description: $t('signUp.serviceUnavailable'),
        color: 'error'
      })
    }
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-4 sm:p-6">
    <UCard class="w-full max-w-md border-slate-200 shadow-md dark:border-slate-800">
      <template #header>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
          {{ $t('signUp.title') }}
        </h2>
      </template>

      <UForm :schema="signUpFormSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('signUp.email')" name="email">
          <UInput
            v-model="state.email"
            class="w-full"
            type="email"
            :placeholder="$t('signUp.emailPlaceholder')"
            autocomplete="email"
            disabled
          />
        </UFormField>

        <UFormField class="mb-8" :label="$t('signUp.password')" name="password">
          <UInput
            v-model="state.password"
            class="w-full"
            type="password"
            :placeholder="$t('signUp.passwordPlaceholder')"
            autocomplete="new-password"
            disabled
          />
        </UFormField>

        <UButton type="submit" color="primary" block size="lg" class="rounded-full" disabled>
          {{ $t('signUp.submit') }}
        </UButton>
      </UForm>

      <USeparator :label="$t('signUp.orContinueWith')" class="my-6" />

      <div class="flex justify-center">
        <UButton
          color="secondary"
          variant="outline"
          size="xl"
          square
          class="rounded-full"
          icon="i-mdi-telegram"
          :title="$t('signUp.telegram')"
          :aria-label="$t('signUp.telegram')"
          @click="registerViaTelegram"
        />
      </div>
    </UCard>
  </div>
</template>
