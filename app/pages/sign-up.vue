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
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h2 class="text-xl font-semibold">
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

        <UButton type="submit" block size="lg" disabled>
          {{ $t('signUp.submit') }}
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
