<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import { formatCurrency } from '@/lib/utils'
import { useTripStore } from '@/stores/tripStore'
import { useUiStore } from '@/stores/uiStore'
import { ArrowLeft, RefreshCw } from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

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
const members = computed(() => tripStore.members)

// Tổng chi chung (chia đều)
const totalSharedExpense = computed(() =>
  tripStore.transactions
    .filter((tx) => tx.type === 'shared_expense')
    .reduce((sum, tx) => sum + tx.amount, 0)
)
const numMembers = computed(() => tripStore.calculateBalances().length)
const perMemberShared = computed(() => numMembers.value > 0 ? Math.round(totalSharedExpense.value / numMembers.value) : 0)

// Tổng chi riêng của 1 thành viên (là người được chi trong split của personal_expense)
const personalExpense = (memberId: string) =>
  tripStore.splits
    .filter((split) => split.member_id === memberId)
    .map((split) => {
      const tx = tripStore.transactions.find((t) => t.id === split.transaction_id)
      return tx && tx.type === 'personal_expense' ? split.amount : 0
    })
    .reduce((sum, amount) => sum + amount, 0)

// Phải nộp của 1 thành viên
const mustPay = (memberId: string) =>
  tripStore.splits
    .filter((split) => split.member_id === memberId)
    .reduce((sum, split) => sum + split.amount, 0)
// Đã nạp của 1 thành viên
const totalDeposited = (memberId: string) =>
  tripStore.transactions
    .filter(
      (tx) =>
        (tx.type === 'income' && tx.paid_by === memberId) ||
        ((tx.type === 'shared_expense' || tx.type === 'personal_expense') && tx.paid_by === memberId && !tx.paid_from_fund)
    )
    .reduce((sum, tx) => sum + tx.amount, 0)



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
      <span v-if="trip" class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="trip.status === 'settled' ? 'bg-emerald-100 text-emerald-700' : trip.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'">
        {{ trip.status === 'settled' ? 'Đã tất toán' : trip.status === 'archived' ? 'Lưu trữ' : 'Đang hoạt động' }}
      </span>
    </div>

    <LoadingSpinner v-if="tripStore.loading" />

    <template v-else>
      <!-- Fund summary -->
      <Card class="mb-4 p-4">
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="font-semibold">Tổng số tiền cần chia</span>
          <span>{{ formatCurrency(totalSharedExpense, trip?.currency_code ?? 'VND') }}</span>
        </div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="font-semibold">Số người cần chia</span>
          <span>{{ numMembers }}</span>
        </div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="font-semibold">Số tiền/người</span>
          <span>{{ formatCurrency(perMemberShared, trip?.currency_code ?? 'VND') }}</span>
        </div>
      </Card>

      <Card class="mb-4 p-4">
        <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Chi tiết từng thành viên</h2>
        <div class="space-y-2">
          <div v-for="m in members" :key="m.id" class="flex flex-col gap-1 border-b border-border pb-2 last:border-b-0">
            <div class="flex items-center justify-between text-sm">
              <span>{{ m.display_name }}</span>
              <span class="font-medium">Đã nộp: {{ formatCurrency(totalDeposited(m.id), trip?.currency_code ?? 'VND')
              }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span>
                Phải nộp: {{ formatCurrency(mustPay(m.id), trip?.currency_code ?? 'VND') }}
                <template v-if="personalExpense(m.id) > 0">
                  (gồm chi riêng: {{ formatCurrency(personalExpense(m.id), trip?.currency_code ?? 'VND') }})
                </template>
              </span>
              <span>
                <template v-if="totalDeposited(m.id) > mustPay(m.id)">
                  <span class="text-emerald-600 font-semibold">Hoàn lại {{ formatCurrency(totalDeposited(m.id) -
                    mustPay(m.id), trip?.currency_code ?? 'VND') }}</span>
                </template>
                <template v-else-if="totalDeposited(m.id) < mustPay(m.id)">
                  <span class="text-red-500 font-semibold">Cần nộp thêm {{ formatCurrency(mustPay(m.id) -
                    totalDeposited(m.id), trip?.currency_code ?? 'VND') }}</span>
                </template>
                <template v-else>
                  <span class="text-muted-foreground font-medium">Đã thanh toán đủ</span>
                </template>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <EmptyState v-if="members.length < 2" message="Cần ít nhất 2 thành viên để tính nợ" class="mt-8" />

      <!-- Trip status actions -->
      <div class="space-y-2 border-t border-border pt-4">
        <h2 class="mb-2 text-sm font-semibold text-muted-foreground">Quản lý chuyến đi</h2>
        <Button v-if="trip?.status !== 'archived'" class="w-full"
          :variant="trip?.status === 'settled' ? 'outline' : 'default'" @click="toggleStatus">
          <RefreshCw :size="16" class="mr-2" />
          {{ trip?.status === 'settled' ? 'Mở lại chuyến đi' : 'Đánh dấu đã tất toán' }}
        </Button>
        <Button v-if="trip?.status !== 'archived'" variant="outline"
          class="w-full text-destructive hover:bg-destructive/10" @click="archiveTrip">
          Lưu trữ chuyến đi
        </Button>
        <!-- Nút xoá trip: chỉ hiển thị khi đã lưu trữ, đặt cuối trang -->
        <Button v-if="trip?.status === 'archived'" class="w-full mt-8" variant="destructive" size="sm"
          @click="handleDeleteTrip">
          Xoá chuyến đi
        </Button>
      </div>
    </template>
  </div>
</template>
