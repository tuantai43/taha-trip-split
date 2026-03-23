import {
  addDoc,
  collection,
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Transaction {
  id?: string;
  paidBy: string; // memberId
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
  createdAt?: import("firebase/firestore").Timestamp;
  updatedAt?: import("firebase/firestore").Timestamp;
}

export function transactionsCol(tripId: string) {
  return collection(db, `trips/${tripId}/transactions`);
}

function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export async function addTransaction(
  tripId: string,
  tx: Omit<Transaction, "createdAt" | "updatedAt">,
) {
  const now = Timestamp.now();
  if (tx.id) {
    const { id, ...data } = tx;
    await setDoc(firestoreDoc(transactionsCol(tripId), id), omitUndefined({
      ...data,
      createdAt: now,
      updatedAt: now,
    }));
    return id;
  }

  const docRef = await addDoc(transactionsCol(tripId), omitUndefined({
    ...tx,
    createdAt: now,
    updatedAt: now,
  }));
  return docRef.id;
}

export async function getTransactions(tripId: string) {
  const snap = await getDocs(transactionsCol(tripId));
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
}

export function subscribeTransactions(
  tripId: string,
  callback: (transactions: Transaction[]) => void,
) {
  return onSnapshot(transactionsCol(tripId), (snap) => {
    callback(
      snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[],
    );
  });
}

export async function getTransaction(tripId: string, txId: string) {
  const docRef = firestoreDoc(transactionsCol(tripId), txId);
  const snap = await getDoc(docRef);
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as Transaction)
    : null;
}

export async function updateTransaction(
  tripId: string,
  txId: string,
  data: Partial<Transaction>,
) {
  const docRef = firestoreDoc(transactionsCol(tripId), txId);
  await updateDoc(docRef, omitUndefined({ ...data, updatedAt: Timestamp.now() }));
}

export async function deleteTransaction(tripId: string, txId: string) {
  const docRef = firestoreDoc(transactionsCol(tripId), txId);
  await deleteDoc(docRef);
}
