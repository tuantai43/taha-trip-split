<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
    <slot name="icon" />
    <p class="text-sm">{{ message ?? 'Không có dữ liệu' }}</p>
    <slot name="action" />
  </div>
</template>
