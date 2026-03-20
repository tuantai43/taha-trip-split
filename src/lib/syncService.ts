import { supabase } from "@/lib/supabase";
import { db } from "@/db/database";
import type {
  DexieTrip,
  DexieTripMember,
  DexieTransaction,
  DexieTransactionSplit,
} from "@/db/database";
import { ref } from "vue";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export const syncStatus = ref<"idle" | "syncing" | "error" | "offline">(
  supabaseUrl ? "idle" : "offline",
);
export const lastSyncedAt = ref<string | null>(null);
export const lastSyncError = ref<string | null>(null);

// ─── Check if Supabase is available ──────────────────
function isOnline(): boolean {
  return !!supabaseUrl && navigator.onLine;
}

// ─── Throw with context so we know exactly what failed ───
function throwSyncError(
  table: string,
  action: string,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any,
): never {
  const msg = `[sync] FAILED  table=${table}  action=${action}  id=${id}  code=${error?.code}  msg="${error?.message}"`;
  console.error(msg);
  console.error("[sync] Row sent:", JSON.stringify(row, null, 2));
  throw new Error(msg);
}

// ─── Push local changes to Supabase ──────────────────
// Insert a row; if duplicate (23505), treat as already synced and skip.
async function remoteInsert(
  table: string,
  row: Record<string, unknown>,
  localId: string,
): Promise<void> {
  // Đảm bảo dùng đúng tên bảng Supabase
  const tableMap: Record<string, string> = {
    trips: "tripsplit_trips",
    trip_members: "tripsplit_trip_members",
    transactions: "tripsplit_transactions",
    transaction_splits: "tripsplit_transaction_splits",
  };
  const realTable = tableMap[table] || table;
  const { error } = await supabase.from(realTable).insert(row);
  if (error) {
    if (error.code === "23505") return; // duplicate key → already exists, skip
    throwSyncError(table, "create", localId, row, error);
  }
}

async function pushChanges(userId: string): Promise<void> {
  // Push trips
  const pendingTrips = await db.trips
    .where("_syncStatus")
    .equals("pending")
    .toArray();

  for (const trip of pendingTrips) {
    const row = tripToRow(trip, userId);
    if (trip._syncAction === "create") {
      await remoteInsert("trips", row, trip.id);
      await db.trips.update(trip.id, {
        _syncStatus: "synced",
        _syncAction: undefined,
      });
    } else if (trip._syncAction === "update") {
      const { error } = await supabase
        .from("tripsplit_trips")
        .update(row)
        .eq("id", trip.id);
      if (error) throwSyncError("trips", "update", trip.id, row, error);
      await db.trips.update(trip.id, {
        _syncStatus: "synced",
        _syncAction: undefined,
      });
    } else if (trip._syncAction === "delete") {
      // Xoá tất cả dữ liệu liên quan trên Supabase
      // 1. Xoá transaction_splits
      await supabase
        .from("tripsplit_transaction_splits")
        .delete()
        .in(
          "transaction_id",
          await db.transactions.where("tripId").equals(trip.id).primaryKeys(),
        );
      // 2. Xoá transactions
      await supabase
        .from("tripsplit_transactions")
        .delete()
        .eq("trip_id", trip.id);
      // 3. Xoá trip_members
      await supabase
        .from("tripsplit_trip_members")
        .delete()
        .eq("trip_id", trip.id);
      // 4. Xoá settlements (nếu có bảng này)
      if (supabase.from("tripsplit_trip_members")) {
        await supabase
          .from("tripsplit_trip_members")
          .delete()
          .eq("trip_id", trip.id);
      }
      // 5. Xoá trip
      await supabase.from("tripsplit_trips").delete().eq("id", trip.id);

      // Xoá vật lý local
      await db.transactionSplits
        .where("transactionId")
        .anyOf(
          await db.transactions.where("tripId").equals(trip.id).primaryKeys(),
        )
        .delete();
      await db.transactions.where("tripId").equals(trip.id).delete();
      await db.tripMembers.where("tripId").equals(trip.id).delete();
      if (db.settlements) {
        await db.settlements.where("tripId").equals(trip.id).delete();
      }
      await db.trips.delete(trip.id);
      continue;
    }
  }

  // Push trip members
  const pendingMembers = await db.tripMembers
    .where("_syncStatus")
    .equals("pending")
    .toArray();

  for (const member of pendingMembers) {
    const row = memberToRow(member);
    if (member._syncAction === "create") {
      await remoteInsert("trip_members", row, member.id);
    } else if (member._syncAction === "update") {
      const { error } = await supabase
        .from("tripsplit_trip_members")
        .update(row)
        .eq("id", member.id);
      if (error)
        throwSyncError("trip_members", "update", member.id, row, error);
    }
    await db.tripMembers.update(member.id, {
      _syncStatus: "synced",
      _syncAction: undefined,
    });
  }

  // Push transactions
  // First, ensure all members referenced by pending transactions are in Supabase
  // (handles the case where a member was marked synced locally but never reached Supabase)
  const pendingTx = await db.transactions
    .where("_syncStatus")
    .equals("pending")
    .toArray();

  if (pendingTx.length > 0) {
    const referencedMemberIds = [...new Set(pendingTx.map((tx) => tx.paidBy))];
    const referencedMembers = await db.tripMembers
      .where("id")
      .anyOf(referencedMemberIds)
      .toArray();
    for (const member of referencedMembers) {
      // Re-insert to Supabase; 23505 = already exists, safe to skip
      await remoteInsert("trip_members", memberToRow(member), member.id);
    }
  }

  for (const tx of pendingTx) {
    const row = txToRow(tx, userId);
    if (tx._syncAction === "create") {
      await remoteInsert("transactions", row, tx.id);
    } else if (tx._syncAction === "update") {
      const { error } = await supabase
        .from("tripsplit_transactions")
        .update(row)
        .eq("id", tx.id);
      if (error) throwSyncError("transactions", "update", tx.id, row, error);
    } else if (tx._syncAction === "delete") {
      await supabase
        .from("tripsplit_transaction_splits")
        .delete()
        .eq("transaction_id", tx.id);
      await supabase.from("tripsplit_transactions").delete().eq("id", tx.id);
      // Also physically remove from Dexie now that remote is clean
      await db.transactionSplits.where("transactionId").equals(tx.id).delete();
      await db.transactions.delete(tx.id);
      continue;
    }
    await db.transactions.update(tx.id, {
      _syncStatus: "synced",
      _syncAction: undefined,
    });
  }

  // Push transaction splits
  // Ensure referenced transactions and members are in Supabase first
  const pendingSplits = await db.transactionSplits
    .where("_syncStatus")
    .equals("pending")
    .toArray();

  // Only pre-ensure parents for splits that are being created (not deleted)
  const creatingSplits = pendingSplits.filter(
    (s) => s._syncAction !== "delete",
  );
  if (creatingSplits.length > 0) {
    const refTxIds = [...new Set(creatingSplits.map((s) => s.transactionId))];
    const refMemberIds = [...new Set(creatingSplits.map((s) => s.memberId))];

    const refTxs = await db.transactions.where("id").anyOf(refTxIds).toArray();
    for (const tx of refTxs) {
      if (tx._syncAction !== "delete") {
        await remoteInsert("transactions", txToRow(tx, userId), tx.id);
      }
    }

    const refMembers = await db.tripMembers
      .where("id")
      .anyOf(refMemberIds)
      .toArray();
    for (const m of refMembers) {
      if (m._syncAction !== "delete") {
        await remoteInsert("trip_members", memberToRow(m), m.id);
      }
    }
  }

  for (const split of pendingSplits) {
    const row = splitToRow(split);
    if (split._syncAction === "create") {
      await remoteInsert("transaction_splits", row, split.id);
    } else if (split._syncAction === "update") {
      const { error } = await supabase
        .from("tripsplit_transaction_splits")
        .update(row)
        .eq("id", split.id);
      if (error)
        throwSyncError("transaction_splits", "update", split.id, row, error);
    } else if (split._syncAction === "delete") {
      await supabase
        .from("tripsplit_transaction_splits")
        .delete()
        .eq("id", split.id);
      await db.transactionSplits.delete(split.id);
      continue;
    }
    await db.transactionSplits.update(split.id, {
      _syncStatus: "synced",
      _syncAction: undefined,
    });
  }
}

// ─── Pull remote data into local DB ──────────────────
async function pullChanges(userId: string): Promise<void> {
  // Pull trips the user is a member of
  const { data: remoteMemberships } = await supabase
    .from("tripsplit_trip_members")
    .select("trip_id")
    .eq("user_id", userId);

  const { data: ownedTrips } = await supabase
    .from("tripsplit_trips")
    .select("id")
    .eq("created_by", userId);

  const tripIds = new Set<string>();
  remoteMemberships?.forEach((m) => tripIds.add(m.trip_id));
  ownedTrips?.forEach((t) => tripIds.add(t.id));

  if (tripIds.size === 0) return;

  const tripIdsArr = [...tripIds];

  // Pull trips
  const { data: trips } = await supabase
    .from("tripsplit_trips")
    .select("*")
    .in("id", tripIdsArr);

  if (trips) {
    for (const trip of trips) {
      const local = await db.trips.get(trip.id);
      // Skip if local version is newer (pending changes)
      if (local && local._syncStatus === "pending") continue;
      await db.trips.put(rowToTrip(trip));
    }
  }

  // Pull members for all trips
  const { data: members } = await supabase
    .from("tripsplit_trip_members")
    .select("*")
    .in("trip_id", tripIdsArr);

  if (members) {
    for (const m of members) {
      const local = await db.tripMembers.get(m.id);
      if (local && local._syncStatus === "pending") continue;
      await db.tripMembers.put(rowToMember(m));
    }
  }

  // Pull transactions
  const { data: txs } = await supabase
    .from("tripsplit_transactions")
    .select("*")
    .in("trip_id", tripIdsArr);

  if (txs) {
    for (const tx of txs) {
      const local = await db.transactions.get(tx.id);
      if (local && local._syncStatus === "pending") continue;
      await db.transactions.put(rowToTx(tx));
    }
  }

  // Pull splits
  if (txs && txs.length > 0) {
    const txIds = txs.map((t) => t.id);
    // Supabase IN has a limit, batch if needed
    const batchSize = 100;
    for (let i = 0; i < txIds.length; i += batchSize) {
      const batch = txIds.slice(i, i + batchSize);
      const { data: splits } = await supabase
        .from("tripsplit_transaction_splits")
        .select("*")
        .in("transaction_id", batch);

      if (splits) {
        for (const s of splits) {
          const local = await db.transactionSplits.get(s.id);
          if (local && local._syncStatus === "pending") continue;
          await db.transactionSplits.put(rowToSplit(s));
        }
      }
    }
  }
}

// ─── Full sync ───────────────────────────────────────
export async function syncAll(userId: string): Promise<void> {
  if (!isOnline()) {
    syncStatus.value = "offline";
    return;
  }

  syncStatus.value = "syncing";
  try {
    await pushChanges(userId);
    await pullChanges(userId);
    lastSyncedAt.value = new Date().toISOString();
    lastSyncError.value = null;
    syncStatus.value = "idle";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastSyncError.value = msg;
    syncStatus.value = "error";
  }
}

// ─── Auto-sync setup ─────────────────────────────────
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(userId: string, intervalMs = 60_000): void {
  stopAutoSync();
  // Initial sync
  syncAll(userId);
  // Periodic sync
  syncInterval = setInterval(() => syncAll(userId), intervalMs);
  // Sync when coming back online
  window.addEventListener("online", () => syncAll(userId));
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ─── Row converters: Dexie → Supabase ────────────────
function tripToRow(d: DexieTrip, userId?: string) {
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
    created_by: d.createdBy === "local" ? (userId ?? null) : d.createdBy,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

function memberToRow(d: DexieTripMember) {
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

function txToRow(d: DexieTransaction, userId?: string) {
  return {
    id: d.id,
    trip_id: d.tripId,
    paid_by: d.paidBy,
    amount: d.amount,
    currency_code: d.currencyCode,
    exchange_rate: d.exchangeRate,
    description: d.description,
    category: d.category,
    type: d.type,
    split_method: d.splitMethod,
    paid_from_fund: d.paidFromFund,
    transaction_date: d.transactionDate,
    created_by: d.createdBy === "local" ? (userId ?? null) : d.createdBy,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

function splitToRow(d: DexieTransactionSplit) {
  return {
    id: d.id,
    transaction_id: d.transactionId,
    member_id: d.memberId,
    amount: d.amount,
    is_settled: d.isSettled,
    created_at: d.createdAt,
  };
}

// ─── Row converters: Supabase → Dexie ────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToTrip(r: any): DexieTrip {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    currencyCode: r.currency_code,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    inviteCode: r.invite_code ?? null,
    shareEnabled: r.share_enabled,
    shareToken: r.share_token,
    createdBy: r.created_by ?? "local",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    _syncStatus: "synced",
    _localUpdatedAt: r.updated_at,
  };
}

function rowToMember(r: any): DexieTripMember {
  return {
    id: r.id,
    tripId: r.trip_id,
    userId: r.user_id,
    displayName: r.display_name,
    role: r.role,
    isGuest: r.is_guest,
    claimedBy: r.claimed_by,
    claimedAt: r.claimed_at,
    joinedAt: r.joined_at,
    _syncStatus: "synced",
    _localUpdatedAt: r.joined_at,
  };
}

function rowToTx(r: any): DexieTransaction {
  return {
    id: r.id,
    tripId: r.trip_id,
    paidBy: r.paid_by,
    amount: Number(r.amount),
    currencyCode: r.currency_code,
    exchangeRate: Number(r.exchange_rate),
    description: r.description,
    category: r.category,
    type: r.type,
    splitMethod: r.split_method,
    paidFromFund: r.paid_from_fund,
    transactionDate: r.transaction_date,
    createdBy: r.created_by ?? "local",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    _syncStatus: "synced",
    _localUpdatedAt: r.updated_at,
  };
}

function rowToSplit(r: any): DexieTransactionSplit {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    memberId: r.member_id,
    amount: Number(r.amount),
    isSettled: r.is_settled,
    createdAt: r.created_at,
    _syncStatus: "synced",
    _localUpdatedAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
