<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { Home, Settings, LogIn, LogOut } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background">
    <!-- Main content -->
    <main class="flex-1 pb-16">
      <RouterView />
    </main>

    <!-- Bottom navigation -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
      <div class="mx-auto flex max-w-lg items-center justify-around py-2">
        <button
          class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors"
          :class="route.path === '/' ? 'text-primary' : 'text-muted-foreground'"
          @click="router.push('/')"
        >
          <Home :size="20" />
          <span>Trang chủ</span>
        </button>

        <button
          class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors"
          :class="route.path === '/settings' ? 'text-primary' : 'text-muted-foreground'"
          @click="router.push('/settings')"
        >
          <Settings :size="20" />
          <span>Cài đặt</span>
        </button>

        <button
          v-if="!auth.isAuthenticated"
          class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs text-muted-foreground transition-colors"
          @click="router.push('/auth/login')"
        >
          <LogIn :size="20" />
          <span>Đăng nhập</span>
        </button>

        <button
          v-else
          class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs text-muted-foreground transition-colors"
          @click="auth.signOut()"
        >
          <LogOut :size="20" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </nav>
  </div>
</template>
