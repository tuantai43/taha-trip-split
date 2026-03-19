<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'
import { X } from 'lucide-vue-next'

const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="toast in ui.toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg"
          :class="{
            'border-green-200 bg-green-50 text-green-900': toast.type === 'success',
            'border-red-200 bg-red-50 text-red-900': toast.type === 'error',
            'border-border bg-card text-foreground': toast.type === 'info',
          }"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button
            class="text-current opacity-50 hover:opacity-100"
            @click="ui.toasts = ui.toasts.filter((t) => t.id !== toast.id)"
          >
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
