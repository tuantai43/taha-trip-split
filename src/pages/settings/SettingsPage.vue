<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { Link, LogIn, LogOut, User } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const user = computed(() => auth.user)
const canLinkGoogle = computed(() => auth.isAuthenticated && auth.isPasswordLinked && !auth.isGoogleLinked)
const canLinkPassword = computed(() => auth.isAuthenticated && auth.isGoogleLinked && !auth.isPasswordLinked && !!user.value?.email)
const linkPassword = ref('')

async function handleLinkGoogle() {
  try {
    await auth.linkGoogleAccount()
    ui.showToast('Đã liên kết tài khoản Google', 'success')
  } catch (err: any) {
    const code = err?.code ?? ''
    if (code === 'auth/provider-already-linked') {
      ui.showToast('Tài khoản đã liên kết Google trước đó', 'info')
      return
    }
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      ui.showToast('Tài khoản Google này đã gắn với một tài khoản khác', 'error')
      return
    }
    ui.showToast(auth.getFirebaseAuthErrorMessage(err), 'error')
  }
}

async function handleLinkPassword() {
  if (linkPassword.value.length < 6) {
    ui.showToast('Mật khẩu cần có ít nhất 6 ký tự', 'error')
    return
  }

  try {
    await auth.linkPasswordAccount(linkPassword.value)
    linkPassword.value = ''
    ui.showToast('Đã bật đăng nhập bằng email/mật khẩu', 'success')
  } catch (err: any) {
    const code = err?.code ?? ''
    if (code === 'auth/provider-already-linked') {
      ui.showToast('Tài khoản đã có email/mật khẩu trước đó', 'info')
      return
    }
    ui.showToast(auth.getFirebaseAuthErrorMessage(err), 'error')
  }
}

async function handleLogout() {
  await auth.signOut();
  ui.showToast('Đã đăng xuất', 'success');
  router.push('/auth/login');
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-6 pb-20">
    <h1 class="mb-6 text-xl font-bold">Cài đặt</h1>

    <!-- Profile -->
    <Card class="mb-4 p-4">
      <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Tài khoản</h2>
      <template v-if="auth.isAuthenticated">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User :size="20" class="text-primary" />
          </div>
          <div class="flex-1">
            <p class="font-medium">{{ auth.displayName }}</p>
            <p class="text-sm text-muted-foreground">{{ user?.email ?? 'Không có email' }}</p>
          </div>
        </div>
        <Button variant="destructive" class="mt-4 w-full" @click="handleLogout">
          <LogOut :size="16" class="mr-2" />
          Đăng xuất
        </Button>
      </template>
      <template v-else>
        <p class="mb-3 text-sm text-muted-foreground">Bạn đang dùng chế độ ngoại tuyến</p>
        <Button class="w-full" @click="router.push('/auth/login')">
          <LogIn :size="16" class="mr-2" />
          Đăng nhập
        </Button>
      </template>
    </Card>

    <Card v-if="auth.isAuthenticated" class="mb-4 p-4">
      <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Liên kết đăng nhập</h2>
      <div class="space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Email / Mật khẩu</span>
          <span class="font-medium">{{ auth.isPasswordLinked ? 'Đã liên kết' : 'Chưa liên kết' }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Google</span>
          <span class="font-medium">{{ auth.isGoogleLinked ? 'Đã liên kết' : 'Chưa liên kết' }}</span>
        </div>
      </div>
      <Button v-if="canLinkGoogle" variant="outline" class="mt-4 w-full" :disabled="auth.linkingGoogle" @click="handleLinkGoogle">
        <Link :size="16" class="mr-2" />
        {{ auth.linkingGoogle ? 'Đang liên kết...' : 'Liên kết với Google' }}
      </Button>
      <div v-else-if="canLinkPassword" class="mt-4 space-y-3">
        <Input
          :model-value="linkPassword"
          type="password"
          placeholder="Tạo mật khẩu để đăng nhập bằng form"
          autocomplete="new-password"
          class="w-full"
          @update:model-value="linkPassword = $event"
        />
        <Button class="w-full" variant="outline" :disabled="auth.linkingPassword" @click="handleLinkPassword">
          <Link :size="16" class="mr-2" />
          {{ auth.linkingPassword ? 'Đang bật mật khẩu...' : 'Bật đăng nhập bằng email/mật khẩu' }}
        </Button>
      </div>
      <p v-else-if="auth.isGoogleLinked" class="mt-4 text-xs text-muted-foreground">
        Tài khoản hiện tại đã liên kết với Google. Hiện chưa hỗ trợ gỡ liên kết.
      </p>
      <p v-else class="mt-4 text-xs text-muted-foreground">
        Chỉ hỗ trợ liên kết Google cho tài khoản đang đăng nhập bằng email/mật khẩu.
      </p>
      <p class="mt-2 text-xs text-muted-foreground">
        Sau khi liên kết, bạn có thể dùng cùng một tài khoản để đăng nhập bằng Google hoặc email/mật khẩu.
      </p>
    </Card>

    <!-- App info -->
    <Card class="p-4">
      <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Thông tin ứng dụng</h2>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Phiên bản</span>
          <span>1.0.0</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Công nghệ</span>
          <span>Vue 3 + Firebase</span>
        </div>
      </div>
    </Card>
  </div>
</template>
