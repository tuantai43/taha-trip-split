<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { WifiOff, Mail, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const isRegister = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const submitting = ref(false)
const errorMsg = ref('')

async function handleEmailSubmit() {
  errorMsg.value = ''
  if (!email.value || !password.value) {
    errorMsg.value = 'Vui lòng nhập email và mật khẩu'
    return
  }
  if (isRegister.value && !displayName.value) {
    errorMsg.value = 'Vui lòng nhập tên hiển thị'
    return
  }
  submitting.value = true
  try {
    if (isRegister.value) {
      await auth.signUpWithEmail(email.value, password.value, displayName.value)
      ui.showToast('Đăng ký thành công! Kiểm tra email để xác nhận.', 'success')
    } else {
      await auth.signInWithEmail(email.value, password.value)
      router.push('/')
    }
  } catch (err: any) {
    errorMsg.value = err?.message ?? 'Có lỗi xảy ra'
  } finally {
    submitting.value = false
  }
}

async function loginGoogle() {
  try {
    await auth.signInWithGoogle()
  } catch {
    // OAuth redirects
  }
}

async function loginFacebook() {
  try {
    await auth.signInWithFacebook()
  } catch {
    // OAuth redirects
  }
}

function useOffline() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center px-6">
    <div class="w-full max-w-sm space-y-8">
      <!-- Logo -->
      <div class="text-center">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white"
        >
          T
        </div>
        <h1 class="mt-4 text-2xl font-bold text-foreground">TAHA TripSplit</h1>
        <p class="mt-1 text-sm text-muted-foreground">Chia tiền du lịch cho nhóm bạn</p>
      </div>

      <!-- Email / Password form -->
      <form class="space-y-3" @submit.prevent="handleEmailSubmit">
        <div v-if="isRegister">
          <Input
            :model-value="displayName"
            placeholder="Tên hiển thị"
            autocomplete="name"
            class="w-full"
            @update:model-value="displayName = $event"
          />
        </div>
        <Input
          :model-value="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          class="w-full"
          @update:model-value="email = $event"
        />
        <Input
          :model-value="password"
          type="password"
          placeholder="Mật khẩu"
          class="w-full"
          autocomplete="current-password"
          @update:model-value="password = $event"
        />

        <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

        <Button type="submit" class="w-full gap-2" :disabled="submitting">
          <Loader2 v-if="submitting" :size="16" class="animate-spin" />
          <Mail v-else :size="16" />
          {{ isRegister ? 'Đăng ký' : 'Đăng nhập' }}
        </Button>

        <p class="text-center text-sm text-muted-foreground">
          <template v-if="isRegister">
            Đã có tài khoản?
            <button type="button" class="text-primary underline" @click="isRegister = false">
              Đăng nhập
            </button>
          </template>
          <template v-else>
            Chưa có tài khoản?
            <button type="button" class="text-primary underline" @click="isRegister = true">
              Đăng ký
            </button>
          </template>
        </p>
      </form>

      <!-- Divider -->
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t border-border" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">hoặc</span>
        </div>
      </div>

      <!-- OAuth buttons -->
      <div class="space-y-3">
        <Button class="w-full gap-3" variant="outline" @click="loginGoogle">
          <svg class="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Đăng nhập bằng Google
        </Button>

        <Button class="w-full gap-3" variant="outline" @click="loginFacebook">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
            <path
              d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
            />
          </svg>
          Đăng nhập bằng Facebook
        </Button>
      </div>

      <!-- Divider -->
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t border-border" />
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-background px-2 text-muted-foreground">hoặc</span>
        </div>
      </div>

      <!-- Offline mode -->
      <Button class="w-full" variant="secondary" @click="useOffline">
        <WifiOff :size="18" class="mr-2" />
        Dùng ngoại tuyến (không cần đăng nhập)
      </Button>

      <p class="text-center text-xs text-muted-foreground">
        Dữ liệu ngoại tuyến sẽ được đồng bộ khi bạn đăng nhập sau.
      </p>
    </div>
  </div>
</template>
