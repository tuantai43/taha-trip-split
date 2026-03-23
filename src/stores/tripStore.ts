import type {
  DexieTransaction,
  DexieTransactionSplit,
  DexieTrip,
  DexieTripMember,
} from "@/db/database";
import { db } from "@/db/database";
import {
  addMember as addRemoteMember,
  deleteMember as deleteRemoteMember,
  getMembers as getRemoteMembers,
  subscribeMembers,
  updateMember as updateRemoteMember,
  type Member as RemoteMember,
} from "@/lib/memberService";
import {
  addSplit as addRemoteSplit,
  deleteSplit as deleteRemoteSplit,
  getSplits as getRemoteSplits,
  subscribeSplits,
  type Split as RemoteSplit,
} from "@/lib/splitService";
import {
  addTransaction as addRemoteTransaction,
  deleteTransaction as deleteRemoteTransaction,
  getTransactions as getRemoteTransactions,
  subscribeTransactions,
  updateTransaction as updateRemoteTransaction,
  type Transaction as RemoteTransaction,
} from "@/lib/transactionService";
import {
  createTrip as createRemoteTrip,
  deleteTrip as deleteRemoteTrip,
  getMyTrips as getRemoteTrips,
  getTrip as getRemoteTrip,
  subscribeMyTrips,
  subscribeTrip,
  updateTrip as updateRemoteTrip,
  type Trip as RemoteTrip,
} from "@/lib/tripService";
import type {
  AddMemberInput,
  CreateTransactionInput,
  CreateTripInput,
  MemberBalance,
  OptimizedDebt,
  Transaction,
  TransactionSplit,
  Trip,
  TripMember,
} from "@/types";
import type { Timestamp } from "firebase/firestore";
import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { nextTick, ref } from "vue";
import { useAuthStore } from "./authStore";

export const useTripStore = defineStore("trip", () => {
  const trips = ref<Trip[]>([]);
  const currentTrip = ref<Trip | null>(null);
  const members = ref<TripMember[]>([]);
  const transactions = ref<Transaction[]>([]);
  const splits = ref<TransactionSplit[]>([]);
  const loading = ref(false);
  let unsubscribeTrips: (() => void) | null = null;
  let unsubscribeCurrentTrip: (() => void) | null = null;
  let unsubscribeMembers: (() => void) | null = null;
  let unsubscribeTransactions: (() => void) | null = null;
  const unsubscribeSplits = new Map<string, () => void>();

  function clearTripRealtimeSubscriptions() {
    unsubscribeCurrentTrip?.();
    unsubscribeCurrentTrip = null;
    unsubscribeMembers?.();
    unsubscribeMembers = null;
    unsubscribeTransactions?.();
    unsubscribeTransactions = null;
    unsubscribeSplits.forEach((unsubscribe) => unsubscribe());
    unsubscribeSplits.clear();
  }

  function updateSplitSubscriptions(
    tripId: string,
    remoteTransactions: RemoteTransaction[],
  ) {
    const activeIds = new Set(
      remoteTransactions
        .map((tx) => tx.id)
        .filter((id): id is string => Boolean(id)),
    );

    for (const [txId, unsubscribe] of unsubscribeSplits.entries()) {
      if (!activeIds.has(txId)) {
        unsubscribe();
        unsubscribeSplits.delete(txId);
      }
    }

    for (const txId of activeIds) {
      if (unsubscribeSplits.has(txId)) continue;
      const unsubscribe = subscribeSplits(tripId, txId, (remoteSplits) => {
        const nextSplits = remoteSplits.map((split) =>
          remoteSplitToTransactionSplit(txId, split),
        );
        splits.value = [
          ...splits.value.filter((split) => split.transaction_id !== txId),
          ...nextSplits,
        ];
      });
      unsubscribeSplits.set(txId, unsubscribe);
    }
  }

  // Reset all state to initial values
  function reset() {
    unsubscribeTrips?.();
    unsubscribeTrips = null;
    clearTripRealtimeSubscriptions();
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
    const auth = useAuthStore();

    if (auth.user) {
      const initialTrips = await getRemoteTrips(auth.user.uid);
      trips.value = initialTrips.map(remoteTripToTrip);
      unsubscribeTrips?.();
      unsubscribeTrips = subscribeMyTrips(auth.user.uid, (remoteTrips) => {
        trips.value = remoteTrips.map(remoteTripToTrip);
      });
      loading.value = false;
      return;
    }

    const all = await db.trips.orderBy("updatedAt").reverse().toArray();
    trips.value = [];
    await nextTick();
    trips.value = all.map(dexieToTrip);
    loading.value = false;
  }

  // ─── Load single trip with all related data ────────
  async function loadTrip(tripId: string) {
    loading.value = true;
    const auth = useAuthStore();

    if (auth.user) {
      clearTripRealtimeSubscriptions();
      const remoteTrip = await getRemoteTrip(tripId);
      currentTrip.value = remoteTrip ? remoteTripToTrip(remoteTrip) : null;

      const remoteMembers = await getRemoteMembers(tripId);
      members.value = remoteMembers.map((member) =>
        remoteMemberToTripMember(tripId, member),
      );

      const remoteTransactions = await getRemoteTransactions(tripId);
      transactions.value = remoteTransactions.map((tx) =>
        remoteTransactionToTransaction(tripId, tx),
      );

      const initialSplits: TransactionSplit[] = [];
      for (const tx of remoteTransactions) {
        if (!tx.id) continue;
        const txSplits = await getRemoteSplits(tripId, tx.id);
        initialSplits.push(
          ...txSplits.map((split) => remoteSplitToTransactionSplit(tx.id!, split)),
        );
      }
      splits.value = initialSplits;

      unsubscribeCurrentTrip = subscribeTrip(tripId, (remoteTrip) => {
        currentTrip.value = remoteTrip ? remoteTripToTrip(remoteTrip) : null;
      });
      unsubscribeMembers = subscribeMembers(tripId, (remoteMembers) => {
        members.value = remoteMembers.map((member) =>
          remoteMemberToTripMember(tripId, member),
        );
      });
      unsubscribeTransactions = subscribeTransactions(
        tripId,
        (remoteTransactions) => {
          transactions.value = remoteTransactions.map((tx) =>
            remoteTransactionToTransaction(tripId, tx),
          );
          updateSplitSubscriptions(tripId, remoteTransactions);
        },
      );
      updateSplitSubscriptions(tripId, remoteTransactions);

      loading.value = false;
      return;
    }

    const trip = await db.trips.get(tripId);
    if (trip) currentTrip.value = dexieToTrip(trip);
    members.value = (
      await db.tripMembers.where("tripId").equals(tripId).toArray()
    ).map(dexieToMember);
    transactions.value = (
      await db.transactions.where("tripId").equals(tripId).toArray()
    ).map(dexieToTransaction);
    const txIds = transactions.value.map((t) => t.id);
    if (txIds.length > 0) {
      const allSplits = await db.transactionSplits
        .where("transactionId")
        .anyOf(txIds)
        .toArray();
      splits.value = allSplits.map(dexieToSplit);
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
    const createdBy = auth.user?.uid ?? "local";

    if (auth.user) {
      const tripId = await createRemoteTrip({
        name: input.name,
        description: input.description,
        currencyCode: input.currency_code,
        status: "active",
        startDate: input.start_date,
        endDate: input.end_date,
        inviteCode: Math.random().toString(36).substring(2, 10),
        shareEnabled: false,
        shareToken: undefined,
        createdBy,
      });

      await addRemoteMember(tripId, {
        userId: auth.user.uid,
        displayName: auth.displayName,
        role: "owner",
        isGuest: false,
      });

      await loadTrips();
      return tripId;
    }

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
    });

    // Add owner as first member
    await db.tripMembers.add({
      id: uuidv4(),
      tripId: id,
      userId: null,
      displayName: auth.displayName,
      role: "owner",
      isGuest: !auth.isAuthenticated,
      claimedBy: null,
      claimedAt: null,
      joinedAt: now,
    });

    await loadTrips();
    return id;
  }

  // ─── Add member ────────────────────────────────────
  async function addMember(input: AddMemberInput) {
    const auth = useAuthStore();
    const now = new Date().toISOString();
    const id = uuidv4();

    if (auth.user) {
      const memberId = await addRemoteMember(input.trip_id, {
        displayName: input.display_name,
        role: "member",
        isGuest: true,
      });
      await loadTrip(input.trip_id);
      return memberId;
    }

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
    const auth = useAuthStore();

    if (auth.user) {
      await updateRemoteMember(tripId, memberId, { displayName });
      await loadTrip(tripId);
      return;
    }

    await db.tripMembers.update(memberId, {
      displayName,
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

    if (auth.user) {
      const remoteTxId = await addRemoteTransaction(input.trip_id, {
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
        createdBy: auth.user.uid,
      });

      for (const split of input.splits) {
        await addRemoteSplit(input.trip_id, remoteTxId, {
          memberId: split.member_id,
          amount: split.amount,
          isSettled: false,
        });
      }

      await loadTrip(input.trip_id);
      return remoteTxId;
    }

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
      createdBy: "local",
      createdAt: now,
      updatedAt: now,
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
      });
    }

    await loadTrip(input.trip_id);
    return txId;
  }

  // ─── Delete transaction ────────────────────────────
  async function deleteTransaction(txId: string, tripId: string) {
    const auth = useAuthStore();

    if (auth.user) {
      const existingSplits = await getRemoteSplits(tripId, txId);
      for (const split of existingSplits) {
        if (!split.id) continue;
        await deleteRemoteSplit(tripId, txId, split.id);
      }
      await deleteRemoteTransaction(tripId, txId);
      await loadTrip(tripId);
      return;
    }

    await db.transactionSplits.where("transactionId").equals(txId).delete();
    await db.transactions.delete(txId);
    await loadTrip(tripId);
  }

  // ─── Update transaction ────────────────────────────
  async function updateTransaction(
    txId: string,
    input: CreateTransactionInput,
  ) {
    const auth = useAuthStore();
    const now = new Date().toISOString();

    if (auth.user) {
      await updateRemoteTransaction(input.trip_id, txId, {
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
      });

      const existingSplits = await getRemoteSplits(input.trip_id, txId);
      for (const split of existingSplits) {
        if (!split.id) continue;
        await deleteRemoteSplit(input.trip_id, txId, split.id);
      }
      for (const split of input.splits) {
        await addRemoteSplit(input.trip_id, txId, {
          memberId: split.member_id,
          amount: split.amount,
          isSettled: false,
        });
      }

      await loadTrip(input.trip_id);
      return;
    }

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
    });

    await db.transactionSplits.where("transactionId").equals(txId).delete();
    for (const split of input.splits) {
      await db.transactionSplits.add({
        id: uuidv4(),
        transactionId: txId,
        memberId: split.member_id,
        amount: split.amount,
        isSettled: false,
        createdAt: now,
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
    const auth = useAuthStore();
    const now = new Date().toISOString();

    if (auth.user) {
      await updateRemoteTrip(tripId, { status });
      await loadTrip(tripId);
      await loadTrips();
      return;
    }

    await db.trips.update(tripId, {
      status,
      updatedAt: now,
    });
    await loadTrip(tripId);
    await loadTrips();
  }

  // ─── Update trip ───────────────────────────────────
  async function updateTrip(tripId: string, data: Partial<CreateTripInput>) {
    const auth = useAuthStore();
    const now = new Date().toISOString();

    if (auth.user) {
      await updateRemoteTrip(tripId, {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.currency_code !== undefined
          ? { currencyCode: data.currency_code }
          : {}),
        ...(data.start_date !== undefined ? { startDate: data.start_date } : {}),
        ...(data.end_date !== undefined ? { endDate: data.end_date } : {}),
      });
      await loadTrip(tripId);
      await loadTrips();
      return;
    }

    const updates: Record<string, unknown> = {
      updatedAt: now,
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
    if (auth.user) {
      const trip = await getRemoteTrip(tripId);
      if (!trip) throw new Error("Trip not found");
      if (trip.createdBy !== auth.user.uid) {
        throw new Error("Chỉ chủ chuyến đi mới được phép xoá");
      }

      const remoteTransactions = await getRemoteTransactions(tripId);
      for (const tx of remoteTransactions) {
        if (!tx.id) continue;
        const txSplits = await getRemoteSplits(tripId, tx.id);
        for (const split of txSplits) {
          if (!split.id) continue;
          await deleteRemoteSplit(tripId, tx.id, split.id);
        }
        await deleteRemoteTransaction(tripId, tx.id);
      }

      const remoteMembers = await getRemoteMembers(tripId);
      for (const member of remoteMembers) {
        if (!member.id) continue;
        await deleteRemoteMember(tripId, member.id);
      }

      await deleteRemoteTrip(tripId);
      if (currentTrip.value?.id === tripId) {
        currentTrip.value = null;
        members.value = [];
        transactions.value = [];
        splits.value = [];
      }
      await loadTrips();
      return;
    }

    const trip = await db.trips.get(tripId);
    if (!trip) throw new Error("Trip not found");
    if (trip.createdBy !== "local") {
      throw new Error("Chỉ chủ chuyến đi mới được phép xoá");
    }

    const txIds = await db.transactions
      .where("tripId")
      .equals(tripId)
      .primaryKeys();
    if (txIds.length > 0) {
      await db.transactionSplits.where("transactionId").anyOf(txIds).delete();
    }
    await db.transactions.where("tripId").equals(tripId).delete();
    await db.tripMembers.where("tripId").equals(tripId).delete();
    await db.settlements.where("tripId").equals(tripId).delete();
    await db.trips.delete(tripId);

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

  function remoteTripToTrip(d: RemoteTrip): Trip {
    return {
      id: d.id!,
      name: d.name,
      description: d.description ?? null,
      currency_code: d.currencyCode,
      status: d.status,
      start_date: d.startDate ?? null,
      end_date: d.endDate ?? null,
      invite_code: d.inviteCode ?? null,
      share_enabled: d.shareEnabled,
      share_token: d.shareToken ?? null,
      created_by: d.createdBy,
      created_at: firestoreTimestampToIso(d.createdAt),
      updated_at: firestoreTimestampToIso(d.updatedAt),
    };
  }

  function remoteMemberToTripMember(tripId: string, d: RemoteMember): TripMember {
    return {
      id: d.id!,
      trip_id: tripId,
      user_id: d.userId ?? null,
      display_name: d.displayName,
      role: d.role,
      is_guest: d.isGuest,
      claimed_by: d.claimedBy ?? null,
      claimed_at: d.claimedAt ? firestoreTimestampToIso(d.claimedAt) : null,
      joined_at: firestoreTimestampToIso(d.joinedAt),
    };
  }

  function remoteTransactionToTransaction(
    tripId: string,
    d: RemoteTransaction,
  ): Transaction {
    return {
      id: d.id!,
      trip_id: tripId,
      paid_by: d.paidBy,
      amount: d.amount,
      currency_code: d.currencyCode,
      exchange_rate: d.exchangeRate,
      description: d.description,
      category: d.category as Transaction["category"],
      type: d.type,
      split_method: d.splitMethod,
      paid_from_fund: d.paidFromFund,
      transaction_date: d.transactionDate,
      created_by: d.createdBy,
      created_at: firestoreTimestampToIso(d.createdAt),
      updated_at: firestoreTimestampToIso(d.updatedAt),
    };
  }

  function remoteSplitToTransactionSplit(
    transactionId: string,
    d: RemoteSplit,
  ): TransactionSplit {
    return {
      id: d.id!,
      transaction_id: transactionId,
      member_id: d.memberId,
      amount: d.amount,
      is_settled: d.isSettled,
      created_at: firestoreTimestampToIso(d.createdAt),
    };
  }

  function firestoreTimestampToIso(value: Timestamp | string | undefined): string {
    if (!value) return new Date().toISOString();
    if (typeof value === "string") return value;
    return value.toDate().toISOString();
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
