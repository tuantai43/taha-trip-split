<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTripStore } from '@/stores/tripStore'
import { useUiStore } from '@/stores/uiStore'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
const tripStore = useTripStore()
const ui = useUiStore()

const name = ref('')
const description = ref('')
const currencyCode = ref('VND')
const startDate = ref('')
const endDate = ref('')
const submitting = ref(false)

async function handleSubmit() {
  if (!name.value.trim()) {
    ui.showToast('Vui lòng nhập tên chuyến đi', 'error')
    return
  }

  submitting.value = true
  try {
    const tripId = await tripStore.createTrip({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      currency_code: currencyCode.value,
      start_date: startDate.value || undefined,
      end_date: endDate.value || undefined,
    })
    ui.showToast('Tạo chuyến đi thành công!', 'success')
    router.replace(`/trip/${tripId}`)
  } catch {
    ui.showToast('Có lỗi xảy ra', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg overflow-hidden px-4 pt-4">
    <!-- Header -->
    <div class="mb-6 flex items-center gap-3">
      <button class="rounded-lg p-1 hover:bg-muted" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-lg font-bold">Tạo chuyến đi mới</h1>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Tên chuyến đi <span class="text-destructive">*</span></span>
        <Input v-model="name" placeholder="VD: Đà Lạt 2026" />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Mô tả</span>
        <textarea
          v-model="description"
          rows="2"
          placeholder="Chuyến đi cùng nhóm bạn..."
          class="flex w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Loại tiền</span>
        <select
          v-model="currencyCode"
          class="flex h-10 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="VND">🇻🇳 VND — Việt Nam Đồng</option>
          <option value="USD">🇺🇸 USD — Đô la Mỹ</option>
          <option value="THB">🇹🇭 THB — Bạt Thái</option>
          <option value="JPY">🇯🇵 JPY — Yên Nhật</option>
          <option value="KRW">🇰🇷 KRW — Won Hàn</option>
          <option value="EUR">🇪🇺 EUR — Euro</option>
        </select>
      </label>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Ngày bắt đầu</span>
          <Input v-model="startDate" type="date" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">Ngày kết thúc</span>
          <Input v-model="endDate" type="date" />
        </label>
      </div>

      <Button class="w-full" :disabled="submitting">
        {{ submitting ? 'Đang tạo...' : 'Tạo chuyến đi' }}
      </Button>
    </form>
  </div>
</template>
