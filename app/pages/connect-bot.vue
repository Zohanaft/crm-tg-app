<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth-private',
})

const { t } = useI18n()
const botsStore = useBotsStore()

const connectBotFormSchema = computed(() =>
  v.object({
    token: v.pipe(v.string(), v.minLength(1, t('connectBot.tokenRequired'))),
  }),
)

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
  <div class="mx-auto max-w-md p-4 sm:p-8">
    <UCard class="border-slate-200 shadow-sm dark:border-slate-800">
      <template #header>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
          {{ $t('connectBot.title') }}
        </h2>
      </template>

      <p class="mb-4 text-sm text-slate-600 dark:text-slate-400">
        {{ $t('connectBot.accountHint') }}
      </p>

      <UForm
        :schema="connectBotFormSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField :label="$t('connectBot.tokenLabel')" name="token">
          <UInput
            v-model="state.token"
            class="w-full"
            type="password"
            :placeholder="$t('connectBot.tokenPlaceholder')"
            autocomplete="off"
          />
        </UFormField>

        <UButton
          type="submit"
          color="primary"
          block
          class="rounded-full"
          :loading="loading"
          :disabled="loading"
        >
          {{ $t('connectBot.submit') }}
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
