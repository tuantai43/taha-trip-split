<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTripStore } from '@/stores/tripStore'
import { useUiStore } from '@/stores/uiStore'
import { formatCurrency } from '@/lib/utils'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { ArrowLeft, ArrowRight, CheckCircle2, Wallet, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{ tripId: string }>()
const router = useRouter()
const tripStore = useTripStore()
const ui = useUiStore()

onMounted(async () => {
  if (!tripStore.currentTrip || tripStore.currentTrip.id !== props.tripId) {
    await tripStore.loadTrip(props.tripId)
  }
})

const trip = computed(() => tripStore.currentTrip)
const balances = computed(() => tripStore.calculateBalances())
const debts = computed(() => tripStore.optimizeDebts())
const refunds = computed(() => tripStore.fundRefunds())
const fundRemaining = computed(() => tripStore.fundBalance())
const members = computed(() => tripStore.members)

function memberName(id: string) {
  return members.value.find((m) => m.id === id)?.display_name ?? 'Không rõ'
}

async function markSettled(fromId: string, toId: string, amount: number) {
  try {
    await tripStore.createTransaction({
      trip_id: props.tripId,
      paid_by: fromId,
      amount,
      currency_code: trip.value?.currency_code ?? 'VND',
      description: `${memberName(fromId)} trả ${memberName(toId)}`,
      category: 'other',
      type: 'transfer',
      split_method: 'exact',
      transaction_date: new Date().toISOString().split('T')[0]!,
      splits: [{ member_id: toId, amount }],
    })
    ui.showToast('Đã ghi nhận thanh toán!', 'success')
    await tripStore.loadTrip(props.tripId)
  } catch {
    ui.showToast('Có lỗi xảy ra', 'error')
  }
}

async function toggleStatus() {
  if (!trip.value) return
  const newStatus = trip.value.status === 'settled' ? 'active' : 'settled'
  await tripStore.setTripStatus(props.tripId, newStatus)
  ui.showToast(newStatus === 'settled' ? 'Đã tất toán chuyến đi' : 'Đã mở lại chuyến đi', 'success')
}

async function archiveTrip() {
  if (!confirm('Lưu trữ chuyến đi này? Bạn sẽ không thể thêm giao dịch mới.')) return
  await tripStore.setTripStatus(props.tripId, 'archived')
  ui.showToast('Đã lưu trữ chuyến đi', 'success')
  router.push('/')
}

// Xoá trip (chỉ khi đã lưu trữ)
async function handleDeleteTrip() {
  if (!trip.value) return
  if (!confirm('Bạn có chắc muốn xoá chuyến đi này? Hành động này không thể hoàn tác.')) return
  try {
    await tripStore.deleteTrip(trip.value.id)
    ui.showToast('Đã xoá chuyến đi', 'success')
    router.push('/')
  } catch {
    ui.showToast('Có lỗi xảy ra khi xoá chuyến đi', 'error')
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-4 pb-20">
    <!-- Header -->
    <div class="mb-6 flex items-center gap-3">
      <button class="rounded-lg p-1 hover:bg-muted" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-lg font-bold">Thanh toán</h1>
        <p class="text-sm text-muted-foreground">{{ trip?.name }}</p>
      </div>
      <span
        v-if="trip"
        class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="trip.status === 'settled' ? 'bg-emerald-100 text-emerald-700' : trip.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'"
      >
        {{ trip.status === 'settled' ? 'Đã tất toán' : trip.status === 'archived' ? 'Lưu trữ' : 'Đang hoạt động' }}
      </span>
    </div>

    <LoadingSpinner v-if="tripStore.loading" />

    <template v-else>
      <!-- Fund summary -->
      <Card v-if="fundRemaining !== 0 || refunds.length > 0" class="mb-4 p-4">
        <div class="mb-3 flex items-center gap-2">
          <Wallet :size="16" class="text-primary" />
          <h2 class="text-sm font-semibold text-muted-foreground">Quỹ chung</h2>
        </div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span>Số dư còn lại</span>
          <span class="font-semibold" :class="fundRemaining > 0 ? 'text-primary' : 'text-muted-foreground'">
            {{ formatCurrency(fundRemaining, trip?.currency_code ?? 'VND') }}
          </span>
        </div>
        <div v-if="refunds.length > 0" class="space-y-1.5 border-t border-border pt-2">
          <p class="text-xs text-muted-foreground">Hoàn lại cho người nạp:</p>
          <div v-for="r in refunds" :key="r.member.id" class="flex items-center justify-between text-sm">
            <span>{{ r.member.display_name }}</span>
            <span class="font-medium text-emerald-600">+{{ formatCurrency(r.amount, trip?.currency_code ?? 'VND') }}</span>
          </div>
        </div>
      </Card>

      <!-- Balances summary -->
      <Card class="mb-4 p-4">
        <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Số dư từng người</h2>
        <div class="space-y-2">
          <div v-for="b in balances" :key="b.member_id" class="flex items-center justify-between text-sm">
            <span>{{ memberName(b.member_id) }}</span>
            <span
              class="font-medium"
              :class="b.balance > 0 ? 'text-emerald-600' : b.balance < 0 ? 'text-red-500' : 'text-muted-foreground'"
            >
              {{ b.balance > 0 ? '+' : '' }}{{ formatCurrency(b.balance, trip?.currency_code ?? 'VND') }}
            </span>
          </div>
        </div>
      </Card>

      <!-- Optimized debts -->
      <Card v-if="debts.length > 0" class="mb-4 p-4">
        <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Cần thanh toán</h2>
        <div class="space-y-3">
          <div
            v-for="(d, i) in debts"
            :key="i"
            class="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2 text-sm font-medium">
                <span>{{ d.from.display_name }}</span>
                <ArrowRight :size="14" class="text-muted-foreground" />
                <span>{{ d.to.display_name }}</span>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ formatCurrency(d.amount, trip?.currency_code ?? 'VND') }}
              </p>
            </div>
            <Button size="sm" variant="outline" @click="markSettled(d.from.id, d.to.id, d.amount)">
              <CheckCircle2 :size="14" class="mr-1" />
              Đã trả
            </Button>
          </div>
        </div>
      </Card>

      <div v-else-if="members.length > 1" class="mb-4 text-center text-sm text-muted-foreground">
        Không có khoản nợ — tất cả đã cân bằng! 🎉
      </div>

      <EmptyState v-else message="Cần ít nhất 2 thành viên để tính nợ" class="mt-8" />

      <!-- Trip status actions -->
      <div class="space-y-2 border-t border-border pt-4">
        <h2 class="mb-2 text-sm font-semibold text-muted-foreground">Quản lý chuyến đi</h2>
        <Button
          v-if="trip?.status !== 'archived'"
          class="w-full"
          :variant="trip?.status === 'settled' ? 'outline' : 'default'"
          @click="toggleStatus"
        >
          <RefreshCw :size="16" class="mr-2" />
          {{ trip?.status === 'settled' ? 'Mở lại chuyến đi' : 'Đánh dấu đã tất toán' }}
        </Button>
        <Button
          v-if="trip?.status !== 'archived'"
          variant="outline"
          class="w-full text-destructive hover:bg-destructive/10"
          @click="archiveTrip"
        >
          Lưu trữ chuyến đi
        </Button>
        <!-- Nút xoá trip: chỉ hiển thị khi đã lưu trữ, đặt cuối trang -->
        <Button v-if="trip?.status === 'archived'" class="w-full mt-8" variant="destructive" size="sm" @click="handleDeleteTrip">
          Xoá chuyến đi
        </Button>
      </div>
    </template>
  </div>
</template>
