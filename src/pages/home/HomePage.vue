<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTripStore } from '@/stores/tripStore'
import { formatDate } from '@/lib/utils'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { Plus, MapPin, CalendarDays } from 'lucide-vue-next'

const router = useRouter()
const tripStore = useTripStore()

onMounted(() => {
  tripStore.loadTrips()
})

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Đang diễn ra', color: 'bg-green-100 text-green-700' },
  settled: { label: 'Đã tất toán', color: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Đã lưu trữ', color: 'bg-gray-100 text-gray-500' },
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-4">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-foreground">TAHA TripSplit</h1>
        <p class="text-sm text-muted-foreground">Quản lý chi tiêu chuyến đi</p>
      </div>
    </div>

    <LoadingSpinner v-if="tripStore.loading" />

    <template v-else>
      <!-- Trip list -->
      <div v-if="tripStore.trips.length > 0" class="space-y-3">
        <Card
          v-for="trip in tripStore.trips.filter((t) => t.status !== 'archived')"
          :key="trip.id"
          class="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
          @click="router.push(`/trip/${trip.id}`)"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <MapPin :size="16" class="shrink-0 text-primary" />
                <h3 class="truncate font-semibold text-foreground">{{ trip.name }}</h3>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span v-if="trip.start_date" class="flex items-center gap-1">
                  <CalendarDays :size="12" />
                  {{ formatDate(trip.start_date) }}
                  <template v-if="trip.end_date"> - {{ formatDate(trip.end_date) }}</template>
                </span>
              </div>
            </div>

            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusLabels[trip.status]?.color"
            >
              {{ statusLabels[trip.status]?.label }}
            </span>
          </div>
        </Card>
      </div>

      <!-- Empty state -->
      <EmptyState v-else message="Chưa có chuyến đi nào">
        <template #icon>
          <MapPin :size="48" class="text-muted-foreground/30" />
        </template>
        <template #action>
          <Button size="sm" @click="router.push('/trip/new')">
            <Plus :size="16" class="mr-1" /> Tạo chuyến đi đầu tiên
          </Button>
        </template>
      </EmptyState>
    </template>

    <!-- FAB -->
    <button
      class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      @click="router.push('/trip/new')"
    >
      <Plus :size="24" />
    </button>
  </div>
</template>
