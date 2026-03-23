<script setup lang="ts">
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useTripStore } from '@/stores/tripStore'
import { useUiStore } from '@/stores/uiStore'
import type { Category, SplitMethod, TransactionType } from '@/types'
import { ArrowLeft, Check, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { formatCurrency } from '@/lib/utils'

const props = defineProps<{ tripId: string; txId?: string }>()
const router = useRouter()
const tripStore = useTripStore()
const ui = useUiStore()

const isEditMode = computed(() => !!props.txId)
const isReadOnly = computed(() => tripStore.currentTrip?.status === 'archived')
const editingTransaction = computed(() =>
  props.txId ? tripStore.transactions.find((t) => t.id === props.txId) : null,
)
const transactionTypeOptions = computed(() => {
  const lockedType = isEditMode.value ? editingTransaction.value?.type : null
  return lockedType
    ? [
        {
          value: lockedType,
          label: lockedType === 'income' ? 'Thu' : 'Chi',
        },
      ]
    : [
        { value: 'shared_expense' as const, label: 'Chi' },
        { value: 'income' as const, label: 'Thu' },
      ]
})
const pageTitle = computed(() => {
  if (!isEditMode.value) return 'Thêm giao dịch'
  return editingTransaction.value?.type === 'income' ? 'Sửa khoản thu' : 'Sửa khoản chi'
})
const isEditDataReady = computed(() => !isEditMode.value || !!editingTransaction.value)

onMounted(() => {
  if (!tripStore.currentTrip || tripStore.currentTrip.id !== props.tripId) {
    tripStore.loadTrip(props.tripId)
  }
})

const amount = ref('')
const description = ref('')
const txType = ref<TransactionType>('shared_expense')
const splitMethod = ref<SplitMethod>('equal')
const category = ref<Category>('other')
const paidBy = ref('')
const paidFromFund = ref(true) // Mặc định bật trả từ quỹ chung
function getLocalDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function getLocalTimeString() {
  const d = new Date()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
function parseTransactionDate(value?: string | null): { date: string; time: string } {
  if (!value) {
    return { date: getLocalDateString(), time: getLocalTimeString() }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: value, time: '00:00' }
  }

  const datePart = value.slice(0, 10)
  const timeMatch = value.match(/T(\d{2}:\d{2})/)
  if (timeMatch) {
    return { date: datePart, time: timeMatch[1] ?? '00:00' }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { date: getLocalDateString(), time: getLocalTimeString() }
  }

  return {
    date: `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`,
    time: `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`,
  }
}
function buildTransactionDate(date: string, time: string) {
  return `${date}T${time || '00:00'}:00`
}
const transactionDate = ref(getLocalDateString())
const transactionTime = ref(getLocalTimeString())
const selectedMembers = ref<Set<string>>(new Set())
const submitting = ref(false)

// Select all members by default
const members = computed(() => tripStore.members)
onMounted(() => {
  if (members.value.length > 0) {
    initDefaults()
  }
})

// Watch for members loading
import { watch } from 'vue'
watch(members, (ms) => {
  if (ms.length > 0 && !paidBy.value) {
    initDefaults()
  }
})

// Reset fund toggle when switching to income (fund toggle is not applicable)
watch(txType, (type, oldType) => {
  if (type === 'income') {
    paidFromFund.value = false
  } else if (type === 'shared_expense' && oldType === 'income' && !isEditMode.value) {
    paidFromFund.value = true
  }
})

function initDefaults() {
  if (isEditMode.value) {
    loadEditData()
  } else {
    paidBy.value = members.value[0]!.id
    selectedMembers.value = new Set(members.value.map((m) => m.id))
    transactionDate.value = getLocalDateString()
    transactionTime.value = getLocalTimeString()
    paidFromFund.value = true // Mặc định bật trả từ quỹ chung
  }
}

function loadEditData() {
  const tx = tripStore.transactions.find((t) => t.id === props.txId)
  if (!tx) return
  amount.value = String(tx.amount)
  description.value = tx.description
  txType.value = tx.type
  splitMethod.value = tx.split_method
  category.value = tx.category
  paidBy.value = tx.paid_by
  paidFromFund.value = tx.paid_from_fund
  const parsedTxDate = parseTransactionDate(tx.transaction_date)
  transactionDate.value = parsedTxDate.date
  transactionTime.value = parsedTxDate.time

  const txSplits = tripStore.splits.filter((s) => s.transaction_id === tx.id)
  selectedMembers.value = new Set(txSplits.map((s) => s.member_id))
}

function toggleMember(id: string) {
  const s = new Set(selectedMembers.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedMembers.value = s
}

async function handleDelete() {
  if (!props.txId) return
  if (!confirm('Xóa giao dịch này?')) return
  try {
    await tripStore.deleteTransaction(props.txId, props.tripId)
    ui.showToast('Đã xóa giao dịch', 'success')
    router.back()
  } catch {
    ui.showToast('Có lỗi xảy ra', 'error')
  }
}

const categoryOptions: { value: Category; label: string; icon: string }[] = [
  { value: 'food', label: 'Ăn uống', icon: '🍜' },
  { value: 'accommodation', label: 'Lưu trú', icon: '🏨' },
  { value: 'transport', label: 'Di chuyển', icon: '🚗' },
  { value: 'ticket', label: 'Vé/Tham quan', icon: '🎫' },
  { value: 'shopping', label: 'Mua sắm', icon: '🛒' },
  { value: 'entertainment', label: 'Giải trí', icon: '🎉' },
  { value: 'health', label: 'Y tế', icon: '💊' },
  { value: 'other', label: 'Khác', icon: '📦' },
]

const splitPreview = computed(() => {
  const amt = parseFloat(amount.value) || 0
  const count = selectedMembers.value.size
  if (count === 0 || amt === 0) return []

  if (splitMethod.value === 'equal') {
    const perPerson = Math.floor(amt / count)
    const remainder = amt - perPerson * count
    return members.value
      .filter((m) => selectedMembers.value.has(m.id))
      .map((m, i) => ({
        member_id: m.id,
        name: m.display_name,
        amount: perPerson + (i === 0 ? remainder : 0),
      }))
  }
  return []
})

async function handleSubmit() {
  const amt = parseFloat(amount.value)
  if (!amt || amt <= 0) {
    ui.showToast('Nhập số tiền hợp lệ', 'error')
    return
  }
  if (txType.value !== 'income' && !description.value.trim()) {
    ui.showToast('Nhập mô tả giao dịch', 'error')
    return
  }
  if (paidFromFund.value && txType.value !== 'income') {
    const available = tripStore.fundBalance(isEditMode.value ? props.txId : undefined)
    if (available < amt) {
      ui.showToast(
        `Quỹ chung không đủ (còn ${available.toLocaleString('vi-VN')}). Hãy chọn người chi tiền.`,
        'error',
      )
      return
    }
  }
  if (!paidFromFund.value && !paidBy.value) {
    ui.showToast('Chọn người trả', 'error')
    return
  }

  // Build splits
  let splits: { member_id: string; amount: number }[]

  if (txType.value === 'income') {
    // Ghi có: nạp tiền vào quỹ chung, không cần chia
    splits = []
  } else {
    splits = splitPreview.value.map(({ member_id, amount: a }) => ({ member_id, amount: a }))
  }

  if (splits.length === 0 && txType.value !== 'income') {
    ui.showToast('Chọn người tham gia', 'error')
    return
  }

  submitting.value = true
  try {
    const txInput = {
      trip_id: props.tripId,
      paid_by: paidBy.value,
      amount: amt,
      currency_code: tripStore.currentTrip?.currency_code ?? 'VND',
      description: description.value.trim(),
      category: category.value,
      type: txType.value,
      split_method: splitMethod.value,
      paid_from_fund: paidFromFund.value,
      transaction_date: buildTransactionDate(transactionDate.value, transactionTime.value),
      splits,
    }
    if (isEditMode.value) {
      await tripStore.updateTransaction(props.txId!, txInput)
      ui.showToast('Cập nhật giao dịch thành công!', 'success')
    } else {
      await tripStore.createTransaction(txInput)
      ui.showToast('Thêm giao dịch thành công!', 'success')
    }
    router.back()
  } catch {
    ui.showToast('Có lỗi xảy ra', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg p-4">
    <!-- Header -->
    <div class="mb-6 flex items-center gap-3">
      <button class="rounded-lg p-1 hover:bg-muted" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-lg font-bold">{{ pageTitle }}</h1>
      <button v-if="isEditMode" class="ml-auto rounded-lg p-2 text-destructive hover:bg-destructive/10"
        @click="handleDelete">
        <Trash2 :size="18" />
      </button>
    </div>

    <LoadingSpinner v-if="isEditMode && tripStore.loading && !editingTransaction" />

    <form class="space-y-4" @submit.prevent="handleSubmit" v-else-if="!isReadOnly && isEditDataReady">
      <!-- Transaction type -->
      <div>
        <span class="mb-1.5 block text-sm font-medium">Loại giao dịch</span>
        <div class="flex gap-2">
          <button v-for="opt in transactionTypeOptions" :key="opt.value" type="button" class="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors"
            :class="txType === opt.value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground'"
            :disabled="isEditMode"
            @click="!isEditMode && (txType = opt.value as TransactionType)">
            {{ opt.label }}
          </button>
        </div>
        <p v-if="isEditMode" class="mt-1.5 text-xs text-muted-foreground">
          Không thể đổi loại giao dịch khi đang chỉnh sửa.
        </p>
      </div>

      <!-- Amount -->
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Số tiền <span class="text-destructive">*</span></span>
        <Input v-model="amount" type="number" inputmode="numeric" placeholder="0" class="text-lg font-semibold" />
      </label>

      <!-- Description -->
      <label class="flex flex-col gap-1.5" v-if="txType !== 'income'">
        <span class="text-sm font-medium">Mô tả <span class="text-destructive">*</span></span>
        <Input v-model="description" placeholder="VD: Ăn trưa phở" />
      </label>

      <!-- Paid from fund toggle -->
      <div v-if="txType === 'shared_expense'" class="rounded-lg border border-border px-3 py-2.5">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-sm font-medium">Trả từ quỹ chung</span>
            <p class="text-xs text-muted-foreground">Tiền từ quỹ góp chung, không tính cho 1 người</p>
          </div>
          <button type="button" class="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            :class="paidFromFund ? 'bg-primary' : 'bg-muted'" @click="paidFromFund = !paidFromFund">
            <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              :class="paidFromFund ? 'translate-x-5' : 'translate-x-0'" />
          </button>
        </div>
        <div v-if="paidFromFund" class="mt-2 rounded bg-muted/50 px-2 py-1.5 text-xs">
          Quỹ còn lại: <span class="font-semibold"
            :class="tripStore.fundBalance(isEditMode ? txId : undefined) <= 0 ? 'text-destructive' : 'text-primary'">{{
              formatCurrency(tripStore.fundBalance(isEditMode ? txId : undefined), tripStore.currentTrip?.currency_code ??
                'VND') }}</span>
        </div>
      </div>

      <!-- Paid by -->
      <div v-if="!paidFromFund || txType === 'income'">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">{{ txType === 'income' ? 'Ai nạp tiền?' : 'Ai trả?' }}</span>
          <select v-model="paidBy"
            class="flex h-10 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.display_name }}</option>
          </select>
        </label>
      </div>

      <!-- Category -->
      <div v-if="txType !== 'income'">
        <span class="mb-1.5 block text-sm font-medium">Danh mục</span>
        <div class="flex flex-wrap gap-2">
          <button v-for="cat in categoryOptions" :key="cat.value" type="button"
            class="rounded-full border px-3 py-1.5 text-xs transition-colors"
            :class="category === cat.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'"
            @click="category = cat.value">
            {{ cat.icon }} {{ cat.label }}
          </button>
        </div>
      </div>

      <!-- Personal expense: who benefits -->
      <!-- Đã xoá loại chi riêng, bỏ block này -->

      <!-- Split: who participates -->
      <div v-if="txType === 'shared_expense'">
        <span class="mb-1.5 block text-sm font-medium">Chia cho ai?</span>
        <div class="space-y-1">
          <button v-for="m in members" :key="m.id" type="button"
            class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
            :class="selectedMembers.has(m.id) ? 'border-primary bg-primary/5' : 'border-border'"
            @click="toggleMember(m.id)">
            <div class="flex h-5 w-5 items-center justify-center rounded border"
              :class="selectedMembers.has(m.id) ? 'border-primary bg-primary text-white' : 'border-input'">
              <Check v-if="selectedMembers.has(m.id)" :size="12" />
            </div>
            <span class="flex-1 text-left">{{ m.display_name }}</span>
            <span v-if="selectedMembers.has(m.id)" class="text-xs text-muted-foreground">
              {{splitPreview.find((s) => s.member_id === m.id)?.amount?.toLocaleString('vi-VN') ?? 0}}
            </span>
          </button>
        </div>
      </div>

      <!-- Date time -->
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Ngày giao dịch</span>
          <Input v-model="transactionDate" type="date" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Giờ giao dịch</span>
          <Input v-model="transactionTime" type="time" />
        </label>
      </div>

      <Button class="w-full" :disabled="submitting">
        {{ submitting ? 'Đang lưu...' : isEditMode ? 'Cập nhật giao dịch' : 'Lưu giao dịch' }}
      </Button>
    </form>
    <template v-else-if="isEditMode && !editingTransaction">
      <div class="py-10 text-center text-muted-foreground">
        Không tìm thấy giao dịch cần chỉnh sửa.
      </div>
    </template>
    <template v-else>
      <div class="text-center text-muted-foreground py-10">
        Chuyến đi đã kết thúc. Bạn chỉ có thể xem thông tin.
      </div>
    </template>
  </div>
</template>
