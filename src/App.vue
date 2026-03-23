<script setup lang="ts">
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import { useAuthStore } from '@/stores/authStore'
import { onMounted } from 'vue'

const auth = useAuthStore()

onMounted(() => {
  auth.init()
})
</script>

<template>
  <LoadingSpinner v-if="auth.loading" />
  <RouterView v-else />
  <ToastContainer />
</template>
