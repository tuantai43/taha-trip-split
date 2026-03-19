<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import ToastContainer from '@/components/common/ToastContainer.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.init()
})
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
