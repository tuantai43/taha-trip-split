<script setup lang="ts">
import { ref } from 'vue'
import { useTripStore } from '@/stores/tripStore'
import { useUiStore } from '@/stores/uiStore'
import { formatCurrency } from '@/lib/utils'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { UserPlus, User, Crown, Pencil, Check, X } from 'lucide-vue-next'

const props = defineProps<{ tripId: string }>()
const tripStore = useTripStore()
const ui = useUiStore()

const newMemberName = ref('')
const adding = ref(false)
const editingId = ref<string | null>(null)
const editingName = ref('')

const balances = () => tripStore.calculateBalances()

async function handleAddMember() {
  const name = newMemberName.value.trim()
  if (!name) {
    ui.showToast('Nhập tên thành viên', 'error')
    return
  }
  adding.value = true
  try {
    await tripStore.addMember({ trip_id: props.tripId, display_name: name })
    newMemberName.value = ''
    ui.showToast(`Đã thêm ${name}`, 'success')
  } catch {
    ui.showToast('Có lỗi xảy ra', 'error')
  } finally {
    adding.value = false
  }
}

function startEdit(memberId: string, currentName: string) {
  editingId.value = memberId
  editingName.value = currentName
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function saveEdit(memberId: string) {
  const name = editingName.value.trim()
  if (!name) {
    ui.showToast('Tên không được để trống', 'error')
    return
  }
  try {
    await tripStore.updateMember(memberId, props.tripId, name)
    ui.showToast('Đã đổi tên', 'success')
  } catch {
    ui.showToast('Có lỗi xảy ra', 'error')
  }
  editingId.value = null
  editingName.value = ''
}
</script>

<template>
  <div>
    <!-- Add member -->
    <form class="mb-4 flex gap-2" @submit.prevent="handleAddMember">
      <Input v-model="newMemberName" placeholder="Nhập tên thành viên..." class="flex-1" />
      <Button :disabled="adding" size="icon">
        <UserPlus :size="18" />
      </Button>
    </form>

    <!-- Member list -->
    <div class="space-y-2">
      <Card v-for="member in tripStore.members" :key="member.id" class="flex items-center gap-3 !p-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          :class="member.is_guest ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'"
        >
          <Crown v-if="member.role === 'owner'" :size="18" />
          <User v-else :size="18" />
        </div>
        <div class="min-w-0 flex-1">
          <!-- Editing mode -->
          <div v-if="editingId === member.id" class="flex items-center gap-2">
            <Input
              v-model="editingName"
              class="h-8 text-sm"
              @keyup.enter="saveEdit(member.id)"
              @keyup.escape="cancelEdit"
            />
            <button class="rounded p-1 text-primary hover:bg-primary/10" @click="saveEdit(member.id)">
              <Check :size="16" />
            </button>
            <button class="rounded p-1 text-muted-foreground hover:bg-muted" @click="cancelEdit">
              <X :size="16" />
            </button>
          </div>
          <!-- Display mode -->
          <template v-else>
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{ member.display_name }}</span>
              <button
                class="rounded p-0.5 text-muted-foreground hover:text-foreground"
                @click="startEdit(member.id, member.display_name)"
              >
                <Pencil :size="12" />
              </button>
              <span
                v-if="member.is_guest"
                class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700"
              >
                Khách
              </span>
              <span
                v-if="member.role === 'owner'"
                class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                Chủ trip
              </span>
            </div>
            <div class="text-xs text-muted-foreground">
              Số dư:
              <span
                :class="{
                  'text-primary': (balances().find((b) => b.member_id === member.id)?.balance ?? 0) > 0,
                  'text-destructive': (balances().find((b) => b.member_id === member.id)?.balance ?? 0) < 0,
                }"
              >
                {{ formatCurrency(balances().find((b) => b.member_id === member.id)?.balance ?? 0) }}
              </span>
            </div>
          </template>
        </div>
      </Card>
    </div>
  </div>
</template>
