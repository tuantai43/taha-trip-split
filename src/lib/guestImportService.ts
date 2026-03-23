import { db } from "@/db/database";
import type {
  DexieTransaction,
  DexieTransactionSplit,
  DexieTrip,
  DexieTripMember,
} from "@/db/database";
import { addMember, type Member } from "@/lib/memberService";
import { addSplit, type Split } from "@/lib/splitService";
import { addTransaction, type Transaction } from "@/lib/transactionService";
import { createTrip, type Trip } from "@/lib/tripService";
import { ref } from "vue";

const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const hasFirebaseConfig = Boolean(firebaseProjectId);

export const guestImportStatus = ref<
  "idle" | "importing" | "error" | "offline"
>(hasFirebaseConfig ? "idle" : "offline");
export const lastGuestImportAt = ref<string | null>(null);
export const lastGuestImportError = ref<string | null>(null);

let onlineHandler: (() => void) | null = null;

function isOnline(): boolean {
  return hasFirebaseConfig && navigator.onLine;
}

export async function importGuestData(userId: string): Promise<void> {
  if (!isOnline()) {
    guestImportStatus.value = "offline";
    return;
  }

  guestImportStatus.value = "importing";
  try {
    await importGuestDataToFirebase(userId);
    lastGuestImportAt.value = new Date().toISOString();
    lastGuestImportError.value = null;
    guestImportStatus.value = "idle";
  } catch (error) {
    lastGuestImportError.value =
      error instanceof Error ? error.message : String(error);
    guestImportStatus.value = "error";
    throw error;
  }
}

export function startGuestImportMonitor(userId: string): void {
  stopGuestImportMonitor();
  void importGuestData(userId);
  onlineHandler = () => {
    void importGuestData(userId);
  };
  window.addEventListener("online", onlineHandler);
}

export function stopGuestImportMonitor(): void {
  if (onlineHandler) {
    window.removeEventListener("online", onlineHandler);
    onlineHandler = null;
  }
}

async function importGuestDataToFirebase(userId: string): Promise<void> {
  const guestTrips = await db.trips.where("createdBy").equals("local").toArray();
  if (guestTrips.length === 0) return;

  for (const guestTrip of guestTrips) {
    await importGuestTrip(userId, guestTrip.id);
  }
}

async function importGuestTrip(userId: string, tripId: string): Promise<void> {
  const guestTrip = await db.trips.get(tripId);
  if (!guestTrip || guestTrip.createdBy !== "local") return;

  const tripMembers = await db.tripMembers.where("tripId").equals(tripId).toArray();
  const ownerMember = tripMembers.find((member) => member.role === "owner");
  const memberIdMap = new Map<string, string>();
  const normalizedMembers = tripMembers.map((member) => {
    const isOwner = member.id === ownerMember?.id;
    const normalizedId = member.id;
    memberIdMap.set(member.id, normalizedId);
    return buildImportedMember(member, normalizedId, userId, isOwner);
  });
  const transactions = await db.transactions.where("tripId").equals(tripId).toArray();
  const transactionIds = transactions.map((tx) => tx.id);
  const splits = transactionIds.length
    ? await db.transactionSplits.where("transactionId").anyOf(transactionIds).toArray()
    : [];

  await createTrip(toRemoteTrip(guestTrip, userId));

  for (const member of normalizedMembers) {
    await addMember(tripId, member);
  }

  for (const transaction of transactions) {
    const normalizedTransaction = toRemoteTransaction(transaction, userId, memberIdMap);
    if (!normalizedTransaction) continue;
    await addTransaction(tripId, normalizedTransaction);
  }

  for (const split of splits) {
    const normalizedSplit = toRemoteSplit(split, memberIdMap);
    if (!normalizedSplit) continue;
    await addSplit(tripId, split.transactionId, normalizedSplit);
  }

  await deleteLocalTripGraph(tripId);
}

async function deleteLocalTripGraph(tripId: string): Promise<void> {
  const transactionIds = await db.transactions.where("tripId").equals(tripId).primaryKeys();
  if (transactionIds.length > 0) {
    await db.transactionSplits.where("transactionId").anyOf(transactionIds).delete();
  }

  await db.transactions.where("tripId").equals(tripId).delete();
  await db.tripMembers.where("tripId").equals(tripId).delete();
  await db.settlements.where("tripId").equals(tripId).delete();
  await db.trips.delete(tripId);
}

function toRemoteTrip(trip: DexieTrip, userId: string): Trip {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description ?? undefined,
    currencyCode: trip.currencyCode,
    status: trip.status,
    startDate: trip.startDate ?? undefined,
    endDate: trip.endDate ?? undefined,
    inviteCode: trip.inviteCode ?? undefined,
    shareEnabled: trip.shareEnabled,
    shareToken: trip.shareToken ?? undefined,
    createdBy: userId,
  };
}

function buildImportedMember(
  member: DexieTripMember,
  normalizedId: string,
  userId: string,
  isOwner: boolean,
): Member {
  if (isOwner) {
    return {
      id: normalizedId,
      userId,
      displayName: member.displayName,
      role: "owner",
      isGuest: false,
      claimedBy: undefined,
      claimedAt: undefined,
    };
  }

  return {
    id: normalizedId,
    userId: undefined,
    displayName: member.displayName,
    role: "member",
    isGuest: true,
    claimedBy: undefined,
    claimedAt: undefined,
  };
}

function toRemoteTransaction(
  transaction: DexieTransaction,
  userId: string,
  memberIdMap: Map<string, string>,
): Transaction | null {
  const paidBy = memberIdMap.get(transaction.paidBy);
  if (!paidBy) return null;

  return {
    id: transaction.id,
    paidBy,
    amount: transaction.amount,
    currencyCode: transaction.currencyCode,
    exchangeRate: transaction.exchangeRate,
    description: transaction.description,
    category: transaction.category,
    type: transaction.type,
    splitMethod: transaction.splitMethod,
    paidFromFund: transaction.paidFromFund,
    transactionDate: transaction.transactionDate,
    createdBy: userId,
  };
}

function toRemoteSplit(
  split: DexieTransactionSplit,
  memberIdMap: Map<string, string>,
): Split | null {
  const memberId = memberIdMap.get(split.memberId);
  if (!memberId) return null;

  return {
    id: split.id,
    memberId,
    amount: split.amount,
    isSettled: split.isSettled,
  };
}
