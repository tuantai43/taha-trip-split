<script setup lang="ts">
// Tag màu cho loại giao dịch
const typeTagColors: Record<string, string> = {
  shared_expense: 'bg-red-100 text-red-700', // Chi: đỏ
  income: 'bg-green-100 text-green-700',     // Thu: xanh lá
}
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import MemberTab from '@/pages/trip/MemberTab.vue'
import { useTripStore } from '@/stores/tripStore'
import { useUiStore } from '@/stores/uiStore'
import {
  ArrowLeft,
  Car,
  ChartPie,
  Copy,
  Hotel,
  Package,
  PartyPopper,
  Pill,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Ticket,
  Users,
  Utensils
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ tripId: string }>()
const router = useRouter()
const tripStore = useTripStore()
const ui = useUiStore()

const activeTab = ref<'overview' | 'transactions' | 'members'>('overview')
const isReadOnly = computed(() => tripStore.currentTrip?.status === 'archived')

onMounted(() => {
  tripStore.loadTrip(props.tripId)
})

const totalIncome = computed(() =>
  tripStore.transactions
    .filter((tx) => tx.type === 'income' || (!tx.paid_from_fund && tx.type === 'shared_expense'))
    .reduce((sum, tx) => sum + tx.amount, 0)
)

const fundRemaining = computed(() => tripStore.fundBalance())

const totalSpent = computed(() =>
  tripStore.transactions
    .filter((tx) => tx.type === 'shared_expense')
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

function getPayerLabel(tx: { paid_by: string; paid_from_fund: boolean }) {
  return tx.paid_from_fund ? 'Quỹ chung' : getMemberName(tx.paid_by)
}

function getTransactionsByDate() {
  const grouped = new Map<string, typeof tripStore.transactions>()
  const sorted = [...tripStore.transactions].sort(
    (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
  )
  for (const tx of sorted) {
    const date = tx.transaction_date.slice(0, 10)
    if (!grouped.has(date)) grouped.set(date, [])
    grouped.get(date)!.push(tx)
  }
  // Sort date groups descending (independent of created_at order)
  return new Map([...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])))
}

const typeLabels: Record<string, string> = {
  shared_expense: 'Chi',
  income: 'Thu',
}

function getSplitMembersLabel(tx: any) {
  if (tx.type !== 'shared_expense') return ''
  const splits = tripStore.splits.filter(s => s.transaction_id === tx.id)
  const memberIds = splits.map(s => s.member_id)
  const allMemberIds = tripStore.members.map(m => m.id)
  if (memberIds.length === allMemberIds.length && memberIds.every(id => allMemberIds.includes(id))) {
    return 'tất cả'
  }
  const names = memberIds.map(id => getMemberName(id))
  if (names.length <= 3) return names.join(', ')
  return names.slice(0, 3).join(', ') + ` + ${names.length - 3} thành viên khác`
}

function sanitizeClipboardCell(value: string | number | boolean | null | undefined) {
  return String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

function buildTransactionsClipboardText() {
  const rows = [
    [
      'Ngày',
      'Giờ',
      'Loại',
      'Mô tả',
      'Danh mục',
      'Số tiền',
      'Tiền tệ',
      'Người trả',
      'Từ quỹ',
      'Chia cho',
    ],
  ]

  const sortedTransactions = [...tripStore.transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
  )

  for (const tx of sortedTransactions) {
    const splitNames = tripStore.splits
      .filter(split => split.transaction_id === tx.id)
      .map(split => getMemberName(split.member_id))
      .join(', ')

    rows.push([
      sanitizeClipboardCell(formatDate(tx.transaction_date, 'long')),
      sanitizeClipboardCell(formatTime(tx.transaction_date)),
      sanitizeClipboardCell(typeLabels[tx.type] ?? tx.type),
      sanitizeClipboardCell(tx.description),
      sanitizeClipboardCell(tx.category),
      sanitizeClipboardCell(tx.amount),
      sanitizeClipboardCell(tx.currency_code),
      sanitizeClipboardCell(getPayerLabel(tx)),
      sanitizeClipboardCell(tx.paid_from_fund ? 'Có' : 'Không'),
      sanitizeClipboardCell(splitNames),
    ])
  }

  return rows.map(row => row.join('\t')).join('\n')
}

async function handleCopyTransactions() {
  if (tripStore.transactions.length === 0) {
    ui.showToast('Chưa có giao dịch để copy', 'info')
    return
  }

  try {
    await navigator.clipboard.writeText(buildTransactionsClipboardText())
    ui.showToast('Đã copy danh sách giao dịch để dán vào Excel', 'success')
  } catch {
    ui.showToast('Không thể copy vào clipboard', 'error')
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg p-4">
    <LoadingSpinner v-if="tripStore.loading && !tripStore.currentTrip" />

    <template v-else-if="tripStore.currentTrip">
      <!-- Header -->
      <div class="mb-4 flex items-center gap-3">
        <button class="rounded-lg p-1 hover:bg-muted" @click="router.push('/')">
          <ArrowLeft :size="20" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-bold">{{ tripStore.currentTrip.name }}</h1>
        </div>
        <button class="rounded-lg p-2 hover:bg-muted" @click="router.push(`/trip/${tripId}/settle`)">
          <Settings :size="18" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        <button class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'overview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="activeTab = 'overview'">
          <ChartPie :size="14" class="mr-1 inline" /> Tổng thể
        </button>
        <button class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'transactions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="activeTab = 'transactions'">
          <Receipt :size="14" class="mr-1 inline" /> Giao dịch
        </button>
        <button class="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'members' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="activeTab = 'members'">
          <Users :size="14" class="mr-1 inline" /> Thành viên
        </button>
      </div>

      <!-- Tab: Transactions -->
      <div v-if="activeTab === 'transactions'">
        <div v-if="tripStore.transactions.length > 0" class="mb-3 flex justify-end">
          <Button variant="outline" size="sm" @click="handleCopyTransactions">
            <Copy :size="16" class="mr-1" />
            Copy Excel
          </Button>
        </div>
        <div v-if="tripStore.transactions.length > 0">
          <template v-for="[date, txs] in getTransactionsByDate()" :key="date">
            <div class="mb-1 mt-4 text-xs font-medium text-muted-foreground">
              {{ formatDate(date, 'long') }}
            </div>
            <div class="space-y-2">
              <Card v-for="tx in txs" :key="tx.id" class="flex items-center gap-3 !p-3"
                :class="isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:bg-muted/50'"
                @click="!isReadOnly && router.push(`/trip/${tripId}/transaction/${tx.id}/edit`)">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <component :is="categoryIcons[tx.category] ?? Package" :size="18" class="text-muted-foreground" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span v-if="tx.type !== 'income'" class="truncate text-sm font-medium">{{ tx.description }}</span>
                    <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      :class="typeTagColors[tx.type] || 'bg-muted text-muted-foreground'">
                      {{ typeLabels[tx.type] }}
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <template v-if="tx.type === 'shared_expense'">
                      {{ getPayerLabel(tx) }} đã trả cho {{
                        getSplitMembersLabel(tx) }} · {{ formatTime(tx.transaction_date) }}
                    </template>
                    <template v-else-if="tx.type === 'income'">
                      {{ getMemberName(tx.paid_by) }} đã nạp · {{ formatTime(tx.transaction_date) }}
                    </template>
                  </div>
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
          <template v-if="!isReadOnly" #action>
            <Button size="sm" @click="router.push(`/trip/${tripId}/transaction/new`)">
              <Plus :size="16" class="mr-1" /> Thêm giao dịch
            </Button>
          </template>
        </EmptyState>

        <!-- FAB -->

      </div>

      <!-- Tab: Members -->
      <MemberTab v-if="activeTab === 'members'" :trip-id="tripId" :readonly="isReadOnly" />

      <!-- Tab: Overview -->
      <div v-if="activeTab === 'overview'">
        <Card class="mb-4 p-6 bg-gradient-to-br from-blue-50 to-green-50">
          <div class="mb-3 flex items-center justify-between text-base font-bold text-blue-900">
            <span>Tổng thu</span>
            <span>{{ formatCurrency(totalIncome, tripStore.currentTrip.currency_code) }}</span>
          </div>
          <div class="mb-3 flex items-center justify-between text-base font-bold text-red-700">
            <span>Tổng chi</span>
            <span>{{ formatCurrency(totalSpent, tripStore.currentTrip.currency_code) }}</span>
          </div>
          <div class="mb-1 flex items-center justify-between text-lg font-extrabold text-green-700">
            <span>Tiền còn lại</span>
            <span>{{ formatCurrency(fundRemaining, tripStore.currentTrip.currency_code) }}</span>
          </div>
        </Card>
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
