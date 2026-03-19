<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  label: string
  class?: string
}>()

const model = defineModel<string>()
</script>

<template>
  <label :class="cn('flex flex-col gap-1.5', $props.class)">
    <span class="text-sm font-medium text-foreground">{{ label }}</span>
    <select
      v-model="model"
      class="flex h-10 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <slot />
    </select>
  </label>
</template>
