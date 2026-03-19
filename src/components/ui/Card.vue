<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <div
    :class="cn('rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm', $props.class)"
  >
    <slot />
  </div>
</template>
