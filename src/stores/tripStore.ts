import { defineStore } from "pinia";
import { ref, nextTick } from "vue";
import { db } from "@/db/database";
import type {
  DexieTrip,
  DexieTripMember,
  DexieTransaction,
  DexieTransactionSplit,
} from "@/db/database";
import { v4 as uuidv4 } from "uuid";
import type {
  Trip,
  TripMember,
  Transaction,
  TransactionSplit,
  CreateTripInput,
  CreateTransactionInput,
  AddMemberInput,
  MemberBalance,
  OptimizedDebt,
} from "@/types";
import { useAuthStore } from "./authStore";

export const useTripStore = defineStore("trip", () => {
  const trips = ref<Trip[]>([]);
  const currentTrip = ref<Trip | null>(null);
  const members = ref<TripMember[]>([]);
  const transactions = ref<Transaction[]>([]);
  const splits = ref<TransactionSplit[]>([]);
  const loading = ref(false);

  // Reset all state to initial values
  function reset() {
    trips.value = [];
    currentTrip.value = null;
    members.value = [];
    transactions.value = [];
    splits.value = [];
    loading.value = false;
  }

  // ─── Load trips ────────────────────────────────────
  async function loadTrips() {
    loading.value = true;
    const all = await db.trips.orderBy("updatedAt").reverse().toArray();
    // Filter out trips marked for deletion
    const visible = all.filter((t) => t._syncAction !== "delete");
    // Force replace array reference for reactivity
    trips.value = [];
    await nextTick();
    trips.value = visible.map(dexieToTrip);
    loading.value = false;
  }

  // ─── Load single trip with all related data ────────
  async function loadTrip(tripId: string) {
    loading.value = true;
    const trip = await db.trips.get(tripId);
    if (trip) currentTrip.value = dexieToTrip(trip);
    members.value = (
      await db.tripMembers.where("tripId").equals(tripId).toArray()
    ).map(dexieToMember);
    // Exclude transactions pending deletion so they disappear immediately from UI
    transactions.value = (
      await db.transactions.where("tripId").equals(tripId).toArray()
    )
      .filter((t) => t._syncAction !== "delete")
      .map(dexieToTransaction);
    // Load splits — exclude those pending deletion
    const txIds = transactions.value.map((t) => t.id);
    if (txIds.length > 0) {
      const allSplits = await db.transactionSplits
        .where("transactionId")
        .anyOf(txIds)
        .toArray();
      splits.value = allSplits
        .filter((s) => s._syncAction !== "delete")
        .map(dexieToSplit);
    } else {
      splits.value = [];
    }
    loading.value = false;
  }

  // ─── Create trip ───────────────────────────────────
  async function createTrip(input: CreateTripInput) {
    const auth = useAuthStore();
    const now = new Date().toISOString();
    const id = uuidv4();
    const createdBy = auth.user?.id ?? "local";

    await db.trips.add({
      id,
      name: input.name,
      description: input.description ?? null,
      currencyCode: input.currency_code,
      status: "active",
      startDate: input.start_date ?? null,
      endDate: input.end_date ?? null,
      inviteCode: Math.random().toString(36).substring(2, 10),
      shareEnabled: false,
      shareToken: null,
      createdBy,
      createdAt: now,
      updatedAt: now,
      _syncStatus: "pending",
      _syncAction: "create",
      _localUpdatedAt: now,
    });

    // Add owner as first member
    await db.tripMembers.add({
      id: uuidv4(),
      tripId: id,
      userId: auth.user?.id ?? null,
      displayName: auth.displayName,
      role: "owner",
      isGuest: !auth.isAuthenticated,
      claimedBy: null,
      claimedAt: null,
      joinedAt: now,
      _syncStatus: "pending",
      _syncAction: "create",
      _localUpdatedAt: now,
    });

    await loadTrips();
    return id;
  }

  // ─── Add member ────────────────────────────────────
  async function addMember(input: AddMemberInput) {
    const now = new Date().toISOString();
    const id = uuidv4();

    await db.tripMembers.add({
      id,
      tripId: input.trip_id,
      userId: null,
      displayName: input.display_name,
      role: "member",
      isGuest: true,
      claimedBy: null,
      claimedAt: null,
      joinedAt: now,
      _syncStatus: "pending",
      _syncAction: "create",
      _localUpdatedAt: now,
    });

    members.value = (
      await db.tripMembers.where("tripId").equals(input.trip_id).toArray()
    ).map(dexieToMember);
    return id;
  }

  // ─── Update member ─────────────────────────────────
  async function updateMember(
    memberId: string,
    tripId: string,
    displayName: string,
  ) {
    const now = new Date().toISOString();
    await db.tripMembers.update(memberId, {
      displayName,
      _syncStatus: "pending",
      _syncAction: "update",
      _localUpdatedAt: now,
    });
    members.value = (
      await db.tripMembers.where("tripId").equals(tripId).toArray()
    ).map(dexieToMember);
  }

  // ─── Create transaction ────────────────────────────
  async function createTransaction(input: CreateTransactionInput) {
    const auth = useAuthStore();
    const now = new Date().toISOString();
    const txId = uuidv4();

    await db.transactions.add({
      id: txId,
      tripId: input.trip_id,
      paidBy: input.paid_by,
      amount: input.amount,
      currencyCode: input.currency_code,
      exchangeRate: 1.0,
      description: input.description,
      category: input.category,
      type: input.type,
      splitMethod: input.split_method,
      paidFromFund: input.paid_from_fund ?? false,
      transactionDate: input.transaction_date,
      createdBy: auth.user?.id ?? "local",
      createdAt: now,
      updatedAt: now,
      _syncStatus: "pending",
      _syncAction: "create",
      _localUpdatedAt: now,
    });

    // Add splits
    for (const split of input.splits) {
      await db.transactionSplits.add({
        id: uuidv4(),
        transactionId: txId,
        memberId: split.member_id,
        amount: split.amount,
        isSettled: false,
        createdAt: now,
        _syncStatus: "pending",
        _syncAction: "create",
        _localUpdatedAt: now,
      });
    }

    await loadTrip(input.trip_id);
    return txId;
  }

  // ─── Delete transaction ────────────────────────────
  async function deleteTransaction(txId: string, tripId: string) {
    // Mark for sync deletion instead of physical delete.
    // Physical delete happens in syncService after Supabase confirms.
    // If it was never synced (pending create), delete immediately.
    const tx = await db.transactions.get(txId);
    if (tx?._syncAction === "create" && tx._syncStatus === "pending") {
      // Never reached Supabase — safe to delete locally right away
      await db.transactionSplits.where("transactionId").equals(txId).delete();
      await db.transactions.delete(txId);
    } else {
      // Was synced (or unknown) — mark for remote deletion
      const splitIds = (
        await db.transactionSplits.where("transactionId").equals(txId).toArray()
      ).map((s) => s.id);
      for (const sid of splitIds) {
        await db.transactionSplits.update(sid, {
          _syncStatus: "pending",
          _syncAction: "delete",
        });
      }
      await db.transactions.update(txId, {
        _syncStatus: "pending",
        _syncAction: "delete",
      });
    }
    await loadTrip(tripId);
  }

  // ─── Update transaction ────────────────────────────
  async function updateTransaction(
    txId: string,
    input: CreateTransactionInput,
  ) {
    const now = new Date().toISOString();

    await db.transactions.update(txId, {
      paidBy: input.paid_by,
      amount: input.amount,
      currencyCode: input.currency_code,
      description: input.description,
      category: input.category,
      type: input.type,
      splitMethod: input.split_method,
      paidFromFund: input.paid_from_fund ?? false,
      transactionDate: input.transaction_date,
      updatedAt: now,
      _syncStatus: "pending",
      _syncAction: "update",
      _localUpdatedAt: now,
    });

    // Replace splits: mark synced splits for remote deletion, physically remove pending-create ones (never reached Supabase)
    const existingSplits = await db.transactionSplits
      .where("transactionId")
      .equals(txId)
      .toArray();
    for (const s of existingSplits) {
      if (s._syncStatus === "pending" && s._syncAction === "create") {
        await db.transactionSplits.delete(s.id);
      } else {
        await db.transactionSplits.update(s.id, {
          _syncStatus: "pending",
          _syncAction: "delete",
          _localUpdatedAt: now,
        });
      }
    }
    for (const split of input.splits) {
      await db.transactionSplits.add({
        id: uuidv4(),
        transactionId: txId,
        memberId: split.member_id,
        amount: split.amount,
        isSettled: false,
        createdAt: now,
        _syncStatus: "pending",
        _syncAction: "create",
        _localUpdatedAt: now,
      });
    }

    await loadTrip(input.trip_id);
  }

  // ─── Fund balance ──────────────────────────────────
  function fundBalance(excludeTxId?: string): number {
    let income = 0;
    let spent = 0;
    for (const tx of transactions.value) {
      if (excludeTxId && tx.id === excludeTxId) continue;
      if (tx.type === "income") income += tx.amount;
      if (tx.paid_from_fund) spent += tx.amount;
    }
    return income - spent;
  }

  // ─── Calculate balances ────────────────────────────
  function calculateBalances(): MemberBalance[] {
    return members.value.map((member) => {
      let totalPaid = 0;
      for (const tx of transactions.value) {
        if (tx.paid_from_fund) {
          // Fund pays — no individual credit
          continue;
        }
        if (tx.paid_by === member.id) {
          totalPaid += tx.amount;
        }
      }

      const totalOwed = splits.value
        .filter((s) => s.member_id === member.id)
        .reduce((sum, s) => sum + s.amount, 0);

      return {
        member_id: member.id,
        display_name: member.display_name,
        is_guest: member.is_guest,
        total_paid: totalPaid,
        total_owed: totalOwed,
        balance: totalPaid - totalOwed,
      };
    });
  }

  // ─── Fund refunds ──────────────────────────────────
  // Creditors get refunded from the fund first, leftover goes to person-to-person
  function fundRefunds(): { member: TripMember; amount: number }[] {
    const remaining = fundBalance();
    if (remaining <= 0) return [];

    const balances = calculateBalances();
    const result: { member: TripMember; amount: number }[] = [];
    let available = remaining;

    // Sort creditors by balance descending
    const creditors = balances
      .filter((b) => b.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);

    for (const b of creditors) {
      if (available <= 0) break;
      const member = members.value.find((m) => m.id === b.member_id);
      if (!member) continue;
      const refund = Math.min(Math.round(b.balance), Math.round(available));
      if (refund > 0) {
        result.push({ member, amount: refund });
        available -= refund;
      }
    }

    return result;
  }

  // ─── Optimize debts (Greedy algorithm) ─────────────
  // Subtracts fund refunds from balances, then settles person-to-person
  function optimizeDebts(): OptimizedDebt[] {
    const balances = calculateBalances();
    const refunds = fundRefunds();
    const creditors: { member: TripMember; amount: number }[] = [];
    const debtors: { member: TripMember; amount: number }[] = [];

    for (const b of balances) {
      const member = members.value.find((m) => m.id === b.member_id);
      if (!member) continue;
      const refund = refunds.find((r) => r.member.id === member.id);
      const netBalance = b.balance - (refund?.amount ?? 0);
      if (netBalance > 0.01) creditors.push({ member, amount: netBalance });
      else if (netBalance < -0.01)
        debtors.push({ member, amount: -netBalance });
    }

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const result: OptimizedDebt[] = [];
    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci]!;
      const d = debtors[di]!;
      const transfer = Math.min(c.amount, d.amount);

      if (transfer > 0.01) {
        result.push({
          from: d.member,
          to: c.member,
          amount: Math.round(transfer),
        });
      }

      c.amount -= transfer;
      d.amount -= transfer;
      if (c.amount < 0.01) ci++;
      if (d.amount < 0.01) di++;
    }

    return result;
  }

  // ─── Set trip status ───────────────────────────────
  async function setTripStatus(
    tripId: string,
    status: "active" | "settled" | "archived",
  ) {
    const now = new Date().toISOString();
    await db.trips.update(tripId, {
      status,
      updatedAt: now,
      _syncStatus: "pending",
      _syncAction: "update",
      _localUpdatedAt: now,
    });
    await loadTrip(tripId);
    await loadTrips();
  }

  // ─── Update trip ───────────────────────────────────
  async function updateTrip(tripId: string, data: Partial<CreateTripInput>) {
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updatedAt: now,
      _syncStatus: "pending",
      _syncAction: "update",
      _localUpdatedAt: now,
    };
    if (data.name !== undefined) updates["name"] = data.name;
    if (data.description !== undefined)
      updates["description"] = data.description;
    if (data.currency_code !== undefined)
      updates["currencyCode"] = data.currency_code;
    if (data.start_date !== undefined) updates["startDate"] = data.start_date;
    if (data.end_date !== undefined) updates["endDate"] = data.end_date;

    await db.trips.update(tripId, updates);
    await loadTrips();
  }

  // ─── Delete trip ───────────────────────────────────
  async function deleteTrip(tripId: string) {
    const auth = useAuthStore();
    const trip = await db.trips.get(tripId);
    if (!trip) throw new Error("Trip not found");
    if (trip.createdBy !== (auth.user?.id ?? "local")) {
      throw new Error("Chỉ chủ chuyến đi mới được phép xoá");
    }

    const now = new Date().toISOString();
    // Đánh dấu trip cần xoá
    await db.trips.update(tripId, {
      _syncStatus: "pending",
      _syncAction: "delete",
      _localUpdatedAt: now,
    });

    // Đánh dấu tất cả trip_members cần xoá
    const memberIds = await db.tripMembers
      .where("tripId")
      .equals(tripId)
      .primaryKeys();
    for (const id of memberIds) {
      await db.tripMembers.update(id, {
        _syncStatus: "pending",
        _syncAction: "delete",
        _localUpdatedAt: now,
      });
    }

    // Đánh dấu tất cả transactions và splits cần xoá
    const txIds = await db.transactions
      .where("tripId")
      .equals(tripId)
      .primaryKeys();
    for (const txId of txIds) {
      await db.transactions.update(txId, {
        _syncStatus: "pending",
        _syncAction: "delete",
        _localUpdatedAt: now,
      });
      // Đánh dấu splits của transaction này
      const splitIds = await db.transactionSplits
        .where("transactionId")
        .equals(txId)
        .primaryKeys();
      for (const splitId of splitIds) {
        await db.transactionSplits.update(splitId, {
          _syncStatus: "pending",
          _syncAction: "delete",
          _localUpdatedAt: now,
        });
      }
    }

    // Đánh dấu tất cả settlements cần xoá
    const settlementIds = await db.settlements
      .where("tripId")
      .equals(tripId)
      .primaryKeys();
    for (const id of settlementIds) {
      await db.settlements.update(id, {
        _syncStatus: "pending",
        _syncAction: "delete",
        _localUpdatedAt: now,
      });
    }

    await loadTrips();
  }

  // ─── Helpers: Dexie → Domain ───────────────────────
  function dexieToTrip(d: DexieTrip): Trip {
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      currency_code: d.currencyCode,
      status: d.status,
      start_date: d.startDate,
      end_date: d.endDate,
      invite_code: d.inviteCode,
      share_enabled: d.shareEnabled,
      share_token: d.shareToken,
      created_by: d.createdBy,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    };
  }

  function dexieToMember(d: DexieTripMember): TripMember {
    return {
      id: d.id,
      trip_id: d.tripId,
      user_id: d.userId,
      display_name: d.displayName,
      role: d.role,
      is_guest: d.isGuest,
      claimed_by: d.claimedBy,
      claimed_at: d.claimedAt,
      joined_at: d.joinedAt,
    };
  }

  function dexieToTransaction(d: DexieTransaction): Transaction {
    return {
      id: d.id,
      trip_id: d.tripId,
      paid_by: d.paidBy,
      amount: d.amount,
      currency_code: d.currencyCode,
      exchange_rate: d.exchangeRate,
      description: d.description,
      category: d.category as Transaction["category"],
      type: d.type,
      split_method: d.splitMethod,
      paid_from_fund: d.paidFromFund ?? false,
      transaction_date: d.transactionDate,
      created_by: d.createdBy,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    };
  }

  function dexieToSplit(d: DexieTransactionSplit): TransactionSplit {
    return {
      id: d.id,
      transaction_id: d.transactionId,
      member_id: d.memberId,
      amount: d.amount,
      is_settled: d.isSettled,
      created_at: d.createdAt,
    };
  }

  return {
    trips,
    currentTrip,
    members,
    transactions,
    splits,
    loading,
    loadTrips,
    loadTrip,
    createTrip,
    updateTrip,
    deleteTrip,
    addMember,
    updateMember,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    fundBalance,
    fundRefunds,
    calculateBalances,
    optimizeDebts,
    setTripStatus,
    reset,
  };
});
