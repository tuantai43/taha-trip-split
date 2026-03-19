<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTripStore } from '@/stores/tripStore'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MemberTab from '@/pages/trip/MemberTab.vue'
import {
  ArrowLeft,
  Plus,
  Users,
  Receipt,
  Scale,
  Settings,
  Utensils,
  Hotel,
  Car,
  Ticket,
  ShoppingBag,
  PartyPopper,
  Pill,
  Package,
} from 'lucide-vue-next'

const props = defineProps<{ tripId: string }>()
const router = useRouter()
const tripStore = useTripStore()

const activeTab = ref<'transactions' | 'members' | 'settle'>('transactions')

onMounted(() => {
  tripStore.loadTrip(props.tripId)
})

const totalSpent = computed(() =>
  tripStore.transactions
    .filter((tx) => tx.type === 'shared_expense' || tx.type === 'personal_expense')
    .reduce((sum, tx) => sum + tx.amount, 0),
)

const categoryIcons: Record<string, typeof Utensils> = {
  food: Utensils,
  accommodation: Hotel,
  transport: Car,
  ticket: Ticket,
  shopping: ShoppingBag,
  entertainment: PartyPopper,
  health: Pill,
  other: Package,
}

function getMemberName(memberId: string) {
  return tripStore.members.find((m) => m.id === memberId)?.display_name ?? 'Ai đó'
}

function getTransactionsByDate() {
  const grouped = new Map<string, typeof tripStore.transactions>()
  const sorted = [...tripStore.transactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  for (const tx of sorted) {
    const date = tx.transaction_date
    if (!grouped.has(date)) grouped.set(date, [])
    grouped.get(date)!.push(tx)
  }
  // Sort date groups descending (independent of created_at order)
  return new Map([...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])))
}

const typeLabels: Record<string, string> = {
  shared_expense: 'Chi chung',
  personal_expense: 'Chi riêng',
  transfer: 'Chuyển khoản',
  income: 'Ghi có',
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 pt-4">
    <LoadingSpinner v-if="tripStore.loading && !tripStore.currentTrip" />

    <template v-else-if="tripStore.currentTrip">
      <!-- Header -->
      <div class="mb-4 flex items-center gap-3">
        <button class="rounded-lg p-1 hover:bg-muted" @click="router.push('/')">
          <ArrowLeft :size="20" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-bold">{{ tripStore.currentTrip.name }}</h1>
          <p class="text-xs text-muted-foreground">
            {{ formatCurrency(totalSpent, tripStore.currentTrip.currency_code) }} tổng chi
          </p>
        </div>
        <button class="rounded-lg p-2 hover:bg-muted" @click="router.push(`/trip/${tripId}/settle`)">
          <Settings :size="18" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'transactions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="activeTab = 'transactions'"
        >
          <Receipt :size="14" class="mr-1 inline" /> Giao dịch
        </button>
        <button
          class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'members' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="activeTab = 'members'"
        >
          <Users :size="14" class="mr-1 inline" /> Thành viên
        </button>
        <button
          class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'settle' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="activeTab = 'settle'"
        >
          <Scale :size="14" class="mr-1 inline" /> Tất toán
        </button>
      </div>

      <!-- Tab: Transactions -->
      <div v-if="activeTab === 'transactions'">
        <div v-if="tripStore.transactions.length > 0">
          <template v-for="[date, txs] in getTransactionsByDate()" :key="date">
            <div class="mb-1 mt-4 text-xs font-medium text-muted-foreground">
              {{ formatDate(date, 'long') }}
            </div>
            <div class="space-y-2">
              <Card v-for="tx in txs" :key="tx.id" class="flex cursor-pointer items-center gap-3 !p-3 active:bg-muted/50" @click="router.push(`/trip/${tripId}/transaction/${tx.id}/edit`)">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <component :is="categoryIcons[tx.category] ?? Package" :size="18" class="text-muted-foreground" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ tx.description }}</span>
                    <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {{ typeLabels[tx.type] }}
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground">{{ tx.paid_from_fund ? 'Quỹ chung' : getMemberName(tx.paid_by) }} đã trả · {{ formatTime(tx.created_at) }}</div>
                </div>
                <div class="shrink-0 text-right">
                  <div class="text-sm font-semibold">
                    {{ formatCurrency(tx.amount, tx.currency_code) }}
                  </div>
                </div>
              </Card>
            </div>
          </template>
        </div>
        <EmptyState v-else message="Chưa có giao dịch nào">
          <template #action>
            <Button size="sm" @click="router.push(`/trip/${tripId}/transaction/new`)">
              <Plus :size="16" class="mr-1" /> Thêm giao dịch
            </Button>
          </template>
        </EmptyState>

        <!-- FAB -->
        <button
          class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          @click="router.push(`/trip/${tripId}/transaction/new`)"
        >
          <Plus :size="24" />
        </button>
      </div>

      <!-- Tab: Members -->
      <MemberTab v-if="activeTab === 'members'" :trip-id="tripId" />

      <!-- Tab: Settle -->
      <div v-if="activeTab === 'settle'">
        <!-- Fund info -->
        <div v-if="tripStore.fundBalance() > 0" class="mb-4 rounded-lg border border-border p-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Quỹ còn lại</span>
            <span class="font-semibold text-primary">{{ formatCurrency(tripStore.fundBalance(), tripStore.currentTrip?.currency_code) }}</span>
          </div>
          <div v-for="r in tripStore.fundRefunds()" :key="r.member.id" class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Hoàn {{ r.member.display_name }}</span>
            <span class="font-medium text-emerald-600">+{{ formatCurrency(r.amount, tripStore.currentTrip?.currency_code) }}</span>
          </div>
        </div>

        <div v-if="tripStore.members.length > 1">
          <h3 class="mb-3 text-sm font-semibold text-foreground">Ai nợ ai</h3>
          <div class="space-y-2">
            <Card v-for="debt in tripStore.optimizeDebts()" :key="`${debt.from.id}-${debt.to.id}`" class="!p-3">
              <div class="flex items-center justify-between">
                <div class="text-sm">
                  <span class="font-medium text-destructive">{{ debt.from.display_name }}</span>
                  <span class="mx-1 text-muted-foreground">→</span>
                  <span class="font-medium text-primary">{{ debt.to.display_name }}</span>
                </div>
                <span class="font-semibold">
                  {{ formatCurrency(debt.amount, tripStore.currentTrip?.currency_code) }}
                </span>
              </div>
            </Card>
          </div>
          <div v-if="tripStore.optimizeDebts().length === 0" class="mt-4 text-center text-sm text-muted-foreground">
            Không có nợ — tất cả đã cân bằng! 🎉
          </div>
        </div>
        <EmptyState v-else message="Cần ít nhất 2 thành viên để tính nợ" />
      </div>
    </template>

    <!-- Trip not found -->
    <template v-else>
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <p class="mb-2 text-lg font-semibold text-foreground">Chuyến đi không tồn tại</p>
        <p class="mb-6 text-sm text-muted-foreground">Chuyến đi này đã bị xóa hoặc đường dẫn không hợp lệ.</p>
        <Button @click="router.push('/')">
          <ArrowLeft :size="16" class="mr-1" /> Về trang chủ
        </Button>
      </div>
    </template>
  </div>
</template>
