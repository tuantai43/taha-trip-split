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
}

interface DexieTransactionSplit {
  id: string;
  transactionId: string;
  memberId: string;
  amount: number;
  isSettled: boolean;
  createdAt: string;
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
}

// ─── Database ──────────────────────────────────────────
const db = new Dexie("TahaTripSplit") as Dexie & {
  trips: EntityTable<DexieTrip, "id">;
  tripMembers: EntityTable<DexieTripMember, "id">;
  transactions: EntityTable<DexieTransaction, "id">;
  transactionSplits: EntityTable<DexieTransactionSplit, "id">;
  settlements: EntityTable<DexieSettlement, "id">;
};

db.version(5).stores({
  trips: "id, status, createdBy, shareToken, updatedAt",
  tripMembers: "id, tripId, userId, isGuest, claimedBy, [tripId+userId]",
  transactions: "id, tripId, paidBy, transactionDate, category",
  transactionSplits: "id, transactionId, memberId, [transactionId+memberId]",
  settlements: "id, tripId, fromMember, toMember",
});

export { db };
export type {
  DexieTrip,
  DexieTripMember,
  DexieTransaction,
  DexieTransactionSplit,
  DexieSettlement,
};
