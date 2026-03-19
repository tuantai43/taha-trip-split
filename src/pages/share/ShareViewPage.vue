<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatCurrency, formatDate } from '@/lib/utils'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { supabase } from '@/lib/supabase'
import { Luggage, ArrowRight } from 'lucide-vue-next'

const props = defineProps<{ token: string }>()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const trip = ref<any>(null)
const members = ref<any[]>([])
const transactions = ref<any[]>([])
const debts = ref<any[]>([])

onMounted(async () => {
  try {
    // Fetch trip by share token
    const { data: tripData, error: tripErr } = await supabase
      .from('trips')
      .select('*')
      .eq('share_token', props.token)
      .eq('share_enabled', true)
      .single()

    if (tripErr || !tripData) {
      error.value = 'Link chia sẻ không hợp lệ hoặc đã bị tắt.'
      return
    }
    trip.value = tripData

    // Fetch members
    const { data: memberData } = await supabase
      .from('trip_members')
      .select('id, display_name')
      .eq('trip_id', tripData.id)

    members.value = memberData ?? []

    // Fetch transactions
    const { data: txData } = await supabase
      .from('transactions')
      .select('*, transaction_splits(*)')
      .eq('trip_id', tripData.id)
      .order('transaction_date', { ascending: false })

    transactions.value = txData ?? []

    // Calculate simple debts from balances
    calculateDebts()
  } catch {
    error.value = 'Có lỗi khi tải dữ liệu.'
  } finally {
    loading.value = false
  }
})

function memberName(id: string) {
  return members.value.find((m: any) => m.id === id)?.display_name ?? '?'
}

const totalExpenses = computed(() =>
  transactions.value
    .filter((t: any) => t.type === 'shared_expense')
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0),
)

const perPerson = computed(() => {
  const count = members.value.length
  return count > 0 ? Math.round(totalExpenses.value / count) : 0
})

function calculateDebts() {
  // Build balance map
  const balanceMap = new Map<string, number>()
  for (const m of members.value) {
    balanceMap.set(m.id, 0)
  }
  for (const tx of transactions.value) {
    if (tx.type === 'transfer') continue
    const current = balanceMap.get(tx.paid_by) ?? 0
    balanceMap.set(tx.paid_by, current + tx.amount)
    if (tx.transaction_splits) {
      for (const s of tx.transaction_splits) {
        const cur = balanceMap.get(s.member_id) ?? 0
        balanceMap.set(s.member_id, cur - s.amount)
      }
    }
  }

  // Greedy optimization
  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []
  for (const [id, balance] of balanceMap) {
    if (balance > 1) creditors.push({ id, amount: balance })
    else if (balance < -1) debtors.push({ id, amount: -balance })
  }
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const result: { from: string; to: string; amount: number }[] = []
  let ci = 0,
    di = 0
  while (ci < creditors.length && di < debtors.length) {
    const amt = Math.min(creditors[ci]!.amount, debtors[di]!.amount)
    result.push({ from: debtors[di]!.id, to: creditors[ci]!.id, amount: Math.round(amt) })
    creditors[ci]!.amount -= amt
    debtors[di]!.amount -= amt
    if (creditors[ci]!.amount < 1) ci++
    if (debtors[di]!.amount < 1) di++
  }
  debts.value = result
}

const groupedTxByDate = computed(() => {
  const groups = new Map<string, any[]>()
  for (const tx of transactions.value) {
    const d = tx.transaction_date ?? 'N/A'
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(tx)
  }
  return [...groups.entries()]
})
</script>

<template>
  <div class="mx-auto min-h-screen max-w-lg bg-background px-4 py-6">
    <LoadingSpinner v-if="loading" />

    <div v-else-if="error" class="flex flex-col items-center gap-4 pt-20 text-center">
      <Luggage :size="48" class="text-muted-foreground" />
      <p class="text-muted-foreground">{{ error }}</p>
      <Button variant="outline" @click="router.push('/auth/login')">Đăng nhập</Button>
    </div>

    <template v-else>
      <!-- Trip header -->
      <div class="mb-6 text-center">
        <h1 class="text-xl font-bold">🧳 {{ trip.name }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ trip.start_date ? formatDate(trip.start_date) : '' }}
          {{ trip.start_date && trip.end_date ? ' – ' : '' }}
          {{ trip.end_date ? formatDate(trip.end_date) : '' }}
          • {{ members.length }} người
        </p>
      </div>

      <!-- Total expenses -->
      <Card class="mb-4 p-4 text-center">
        <p class="text-sm text-muted-foreground">💰 Tổng chi tiêu</p>
        <p class="text-2xl font-bold text-primary">
          {{ formatCurrency(totalExpenses, trip.currency_code ?? 'VND') }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ formatCurrency(perPerson, trip.currency_code ?? 'VND') }}/người
        </p>
      </Card>

      <!-- Transactions by date -->
      <div v-if="transactions.length > 0" class="mb-4 space-y-4">
        <div v-for="[date, txs] in groupedTxByDate" :key="date">
          <p class="mb-2 text-xs font-semibold text-muted-foreground">📅 {{ formatDate(date) }}</p>
          <div class="space-y-2">
            <Card v-for="tx in txs" :key="tx.id" class="p-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium">{{ tx.description }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ memberName(tx.paid_by) }} trả
                    <template v-if="tx.transaction_splits?.length > 1">
                      • Chia {{ tx.transaction_splits.length }}:
                      {{ formatCurrency(Math.round(tx.amount / tx.transaction_splits.length), trip.currency_code ?? 'VND') }}/người
                    </template>
                  </p>
                </div>
                <span class="font-semibold">{{ formatCurrency(tx.amount, trip.currency_code ?? 'VND') }}</span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <!-- Debts -->
      <Card v-if="debts.length > 0" class="mb-6 p-4">
        <h2 class="mb-3 text-sm font-semibold">💸 Ai trả ai?</h2>
        <div class="space-y-2">
          <div v-for="(d, i) in debts" :key="i" class="flex items-center gap-2 text-sm">
            <span class="font-medium">{{ memberName(d.from) }}</span>
            <ArrowRight :size="14" class="text-muted-foreground" />
            <span class="font-medium">{{ memberName(d.to) }}</span>
            <span class="ml-auto text-primary">{{ formatCurrency(d.amount, trip.currency_code ?? 'VND') }}</span>
          </div>
        </div>
      </Card>

      <!-- Footer -->
      <div class="border-t border-border pt-4 text-center text-sm text-muted-foreground">
        <p>Chỉ xem • Không thể chỉnh sửa</p>
        <Button class="mt-2" variant="outline" @click="router.push('/auth/login')">
          Đăng nhập để tham gia →
        </Button>
      </div>
    </template>
  </div>
</template>
