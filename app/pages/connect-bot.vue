<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth-private',
})

const { t } = useI18n()
const botsStore = useBotsStore()

const connectBotFormSchema = computed(() => v.object({
  token: v.pipe(v.string(), v.minLength(1, t('connectBot.tokenRequired'))),
}))

type ConnectBotFormState = { token: string }

const state = reactive<ConnectBotFormState>({
  token: '',
})

const loading = ref(false)
const toast = useToast()

async function onSubmit(_event: FormSubmitEvent<ConnectBotFormState>) {
  loading.value = true
  try {
    await botsStore.createBot(state.token)
    toast.add({
      title: t('connectBot.successTitle'),
      description: t('connectBot.successDescription'),
      color: 'success',
    })
    navigateTo('/dashboard')
  } catch {
    toast.add({
      title: t('connectBot.errorTitle'),
      description: t('connectBot.errorDescription'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container mx-auto max-w-md p-8">
    <UCard>
      <template #header>
        <h2 class="text-xl font-semibold">
          {{ $t('connectBot.title') }}
        </h2>
      </template>

      <UForm :schema="connectBotFormSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('connectBot.tokenLabel')" name="token">
          <UInput
            v-model="state.token"
            class="w-full"
            type="password"
            :placeholder="$t('connectBot.tokenPlaceholder')"
            autocomplete="off"
          />
        </UFormField>

        <UButton type="submit" block :loading="loading" :disabled="loading">
          {{ $t('connectBot.submit') }}
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
