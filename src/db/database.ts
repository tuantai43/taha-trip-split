import Dexie, { type EntityTable } from "dexie";

// ─── Dexie interfaces (camelCase for client) ───────────
interface DexieTrip {
  id: string;
  name: string;
  description: string | null;
  currencyCode: string;
  status: "draft" | "active" | "settled" | "archived";
  startDate: string | null;
  endDate: string | null;
  inviteCode: string | null;
  shareEnabled: boolean;
  shareToken: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

interface DexieTripMember {
  id: string;
  tripId: string;
  userId: string | null;
  displayName: string;
  role: "owner" | "member";
  isGuest: boolean;
  claimedBy: string | null;
  claimedAt: string | null;
  joinedAt: string;
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

interface DexieTransaction {
  id: string;
  tripId: string;
  paidBy: string;
  amount: number;
  currencyCode: string;
  exchangeRate: number;
  description: string;
  category: string;
  type: "shared_expense" | "income";
  splitMethod: "equal" | "exact" | "percentage" | "shares";
  paidFromFund: boolean;
  transactionDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

interface DexieTransactionSplit {
  id: string;
  transactionId: string;
  memberId: string;
  amount: number;
  isSettled: boolean;
  createdAt: string;
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

interface DexieSettlement {
  id: string;
  tripId: string;
  fromMember: string;
  toMember: string;
  amount: number;
  currencyCode: string;
  isPaid: boolean;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  _syncStatus: "synced" | "pending" | "conflict" | "error";
  _syncAction?: "create" | "update" | "delete";
  _localUpdatedAt: string;
}

interface DexieSyncQueueItem {
  id?: number;
  tableName: string;
  recordId: string;
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  status: "pending" | "in_progress" | "failed";
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

// ─── Database ──────────────────────────────────────────
const db = new Dexie("TahaTripSplit") as Dexie & {
  trips: EntityTable<DexieTrip, "id">;
  tripMembers: EntityTable<DexieTripMember, "id">;
  transactions: EntityTable<DexieTransaction, "id">;
  transactionSplits: EntityTable<DexieTransactionSplit, "id">;
  settlements: EntityTable<DexieSettlement, "id">;
  syncQueue: EntityTable<DexieSyncQueueItem, "id">;
};

db.version(3).stores({
  trips: "id, status, createdBy, shareToken, _syncStatus, updatedAt",
  tripMembers: "id, tripId, userId, isGuest, claimedBy, [tripId+userId]",
  transactions: "id, tripId, paidBy, transactionDate, category, _syncStatus",
  transactionSplits: "id, transactionId, memberId, [transactionId+memberId]",
  settlements: "id, tripId, fromMember, toMember",
  syncQueue: "++id, tableName, recordId, action, status, createdAt",
});

db.version(4).stores({
  trips: "id, status, createdBy, shareToken, _syncStatus, updatedAt",
  tripMembers:
    "id, tripId, userId, isGuest, claimedBy, _syncStatus, [tripId+userId]",
  transactions: "id, tripId, paidBy, transactionDate, category, _syncStatus",
  transactionSplits:
    "id, transactionId, memberId, _syncStatus, [transactionId+memberId]",
  settlements: "id, tripId, fromMember, toMember",
  syncQueue: "++id, tableName, recordId, action, status, createdAt",
});

export { db };
export type {
  DexieTrip,
  DexieTripMember,
  DexieTransaction,
  DexieTransactionSplit,
  DexieSettlement,
  DexieSyncQueueItem,
};
