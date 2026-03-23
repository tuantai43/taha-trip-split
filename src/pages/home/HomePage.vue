<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import { formatDate } from '@/lib/utils'
import { useTripStore } from '@/stores/tripStore'
import { CalendarDays, MapPin, Plus } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'


import { useAuthStore } from '@/stores/authStore'
const router = useRouter()
const tripStore = useTripStore()
const authStore = useAuthStore()

// Always reload trips when user id changes (login/logout)
watch(
  () => authStore.user?.id,
  () => {
    tripStore.loadTrips()
  },
  { immediate: true }
)

// Tab state for active/archived
const tab = ref<'active' | 'archived'>('active')

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Đang diễn ra', color: 'bg-green-100 text-green-700' },
  settled: { label: 'Đã tất toán', color: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Đã lưu trữ', color: 'bg-gray-100 text-gray-500' },
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 py-4">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-foreground">TAHA TripSplit</h1>
        <p class="text-sm text-muted-foreground">Quản lý chi tiêu chuyến đi</p>
      </div>
    </div>

    <LoadingSpinner v-if="tripStore.loading" />

    <div v-else>
      <!-- Tabs -->
      <div class="mb-4 flex gap-2">
        <button class="rounded px-3 py-1 text-sm font-medium"
          :class="tab === 'active' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'"
          @click="tab = 'active'">
          Đang diễn ra
        </button>
        <button class="rounded px-3 py-1 text-sm font-medium"
          :class="tab === 'archived' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'"
          @click="tab = 'archived'">
          Đã kết thúc
        </button>
      </div>

      <!-- Trip list: Active -->
      <div v-if="tab === 'active'">
        <div v-if="tripStore.trips.filter(t => t.status !== 'archived').length > 0" class="space-y-3">
          <Card v-for="trip in tripStore.trips.filter((t) => t.status !== 'archived')" :key="trip.id"
            class="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
            @click="router.push(`/trip/${trip.id}`)">
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

              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="statusLabels[trip.status]?.color">
                {{ statusLabels[trip.status]?.label }}
              </span>
            </div>
          </Card>
        </div>
        <EmptyState v-if="tripStore.trips.filter(t => t.status !== 'archived').length === 0">
          <template #icon>
            <MapPin :size="48" class="text-muted-foreground/30" />
          </template>
          <template #action>
            <Button size="sm" @click="router.push('/trip/new')">
              <Plus :size="16" class="mr-1" /> Tạo chuyến đi đầu tiên
            </Button>
          </template>
        </EmptyState>
      </div>

      <!-- Trip list: Archived -->
      <div v-if="tab === 'archived'">
        <div v-if="tripStore.trips.filter(t => t.status === 'archived').length > 0" class="space-y-3">
          <Card v-for="trip in tripStore.trips.filter((t) => t.status === 'archived')" :key="trip.id"
            class="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
            @click="router.push(`/trip/${trip.id}`)">
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

              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="statusLabels[trip.status]?.color">
                {{ statusLabels[trip.status]?.label }}
              </span>
            </div>
          </Card>
        </div>
        <EmptyState v-if="tripStore.trips.filter(t => t.status === 'archived').length === 0">
          <template #icon>
            <MapPin :size="48" class="text-muted-foreground/30" />
          </template>
          <template #action>
            <Button size="sm" @click="router.push('/trip/new')">
              <Plus :size="16" class="mr-1" /> Tạo chuyến đi đầu tiên
            </Button>
          </template>
        </EmptyState>
      </div>
    </div>
  </div>
</template>
