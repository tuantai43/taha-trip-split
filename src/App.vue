<script setup lang="ts">
import ToastContainer from '@/components/common/ToastContainer.vue'
import { useAuthStore } from '@/stores/authStore'
import { onMounted } from 'vue'

const auth = useAuthStore()

onMounted(() => {
  auth.init()
})
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
