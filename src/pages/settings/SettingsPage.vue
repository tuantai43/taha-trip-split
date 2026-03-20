<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { User, LogOut, LogIn, RefreshCw, Cloud, CloudOff, Loader2, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const user = computed(() => auth.user)

const syncLabel = computed(() => {
  switch (auth.syncStatus) {
    case 'syncing': return 'Đang đồng bộ...'
    case 'error': return 'Lỗi đồng bộ'
    case 'offline': return 'Ngoại tuyến'
    default: return 'Đã đồng bộ'
  }
})

async function handleSync() {
  await auth.triggerSync()
  if (auth.syncStatus === 'error') {
    ui.showToast('Đồng bộ thất bại', 'error')
  } else {
    ui.showToast('Đồng bộ hoàn tất', 'success')
  }
}

async function handleLogout() {
  // Kiểm tra dữ liệu local chưa sync
  const { db } = await import('@/db/database');
  const [pendingTrips, pendingMembers, pendingTx, pendingSplits] = await Promise.all([
    auth.isAuthenticated ? db.trips.where('_syncStatus').equals('pending').count() : 0,
    auth.isAuthenticated ? db.tripMembers.where('_syncStatus').equals('pending').count() : 0,
    auth.isAuthenticated ? db.transactions.where('_syncStatus').equals('pending').count() : 0,
    auth.isAuthenticated ? db.transactionSplits.where('_syncStatus').equals('pending').count() : 0,
  ]);
  const pendingCount = pendingTrips + pendingMembers + pendingTx + pendingSplits;
  if (pendingCount > 0) {
    if (!confirm('Bạn có dữ liệu chưa đồng bộ lên server. Nếu đăng xuất, dữ liệu này sẽ bị xoá vĩnh viễn. Bạn có chắc chắn muốn đăng xuất?')) {
      return;
    }
  }
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

    <!-- Sync status -->
    <Card v-if="auth.isAuthenticated" class="mb-4 p-4">
      <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Đồng bộ dữ liệu</h2>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <Loader2 v-if="auth.syncStatus === 'syncing'" :size="16" class="animate-spin text-primary" />
          <Cloud v-else-if="auth.syncStatus === 'idle'" :size="16" class="text-green-500" />
          <AlertCircle v-else-if="auth.syncStatus === 'error'" :size="16" class="text-red-500" />
          <CloudOff v-else :size="16" class="text-muted-foreground" />
          <span>{{ syncLabel }}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="auth.syncStatus === 'syncing'"
          @click="handleSync"
        >
          <RefreshCw :size="14" class="mr-1" />
          Đồng bộ
        </Button>
      </div>
      <p v-if="auth.lastSyncError" class="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600 break-all">
        {{ auth.lastSyncError }}
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
          <span>Vue 3 + Supabase</span>
        </div>
      </div>
    </Card>
  </div>
</template>
