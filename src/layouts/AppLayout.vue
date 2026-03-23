<script setup lang="ts">

import { useTripStore } from '@/stores/tripStore'
import { Home, Plus, Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'


const router = useRouter()
const route = useRoute()
const tripStore = useTripStore()

import { computed } from 'vue'
// Xác định active cho nút Thêm
const isAddActive = computed(() => {
  // Đang ở trang tạo trip hoặc tạo giao dịch
  if (route.path === '/trip/new') return true
  if (/^\/trip\/[^/]+\/transaction\/new$/.test(route.path)) return true
  return false
})

function handleAddClick() {
  // Nếu đang ở trip detail hoặc trang settle thì sang thêm giao dịch
  const tripDetailMatch = route.path.match(/^\/trip\/([^/]+)$/)
  const tripSettleMatch = route.path.match(/^\/trip\/([^/]+)\/settle$/)
  let tripId = null
  if (tripDetailMatch) {
    tripId = tripDetailMatch[1]
  } else if (tripSettleMatch) {
    tripId = tripSettleMatch[1]
  }
  if (tripId) {
    // Nếu trip đã archived thì không cho thêm giao dịch
    const trip = tripStore.trips.find(t => t.id === tripId)
    if (trip && trip.status === 'archived') {
      alert('Chuyến đi đã kết thúc. Không thể thêm giao dịch mới.')
      return
    }
    router.push(`/trip/${tripId}/transaction/new`)
    return
  }
  // Ngược lại, sang tạo trip
  router.push('/trip/new')
}
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
        <button class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors"
          :class="route.path === '/' ? 'text-primary' : 'text-muted-foreground'" @click="router.push('/')">
          <Home :size="20" />
          <span>Trang chủ</span>
        </button>

        <button class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors"
          :class="isAddActive ? 'text-primary' : 'text-muted-foreground'" @click="handleAddClick">
          <Plus :size="24" />
          <span>Thêm</span>
        </button>

        <button class="flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors"
          :class="route.path === '/settings' ? 'text-primary' : 'text-muted-foreground'"
          @click="router.push('/settings')">
          <Settings :size="20" />
          <span>Cài đặt</span>
        </button>
      </div>
    </nav>
  </div>
</template>
