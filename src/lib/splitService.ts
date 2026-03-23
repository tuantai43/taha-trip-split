import {
  addDoc,
  collection,
  deleteDoc,
  doc as firestoreDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Split {
  id?: string;
  memberId: string; // memberId
  amount: number;
  isSettled: boolean;
  createdAt?: import("firebase/firestore").Timestamp;
}

export function splitsCol(tripId: string, txId: string) {
  return collection(db, `trips/${tripId}/transactions/${txId}/splits`);
}

function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export async function addSplit(
  tripId: string,
  txId: string,
  split: Omit<Split, "createdAt">,
) {
  const now = Timestamp.now();
  if (split.id) {
    const { id, ...data } = split;
    await setDoc(firestoreDoc(splitsCol(tripId, txId), id), omitUndefined({
      ...data,
      createdAt: now,
    }));
    return id;
  }

  const docRef = await addDoc(splitsCol(tripId, txId), omitUndefined({
    ...split,
    createdAt: now,
  }));
  return docRef.id;
}

export async function getSplits(tripId: string, txId: string) {
  const snap = await getDocs(splitsCol(tripId, txId));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Split[];
}

export function subscribeSplits(
  tripId: string,
  txId: string,
  callback: (splits: Split[]) => void,
) {
  return onSnapshot(splitsCol(tripId, txId), (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Split[]);
  });
}

export async function updateSplit(
  tripId: string,
  txId: string,
  splitId: string,
  data: Partial<Split>,
) {
  const docRef = firestoreDoc(splitsCol(tripId, txId), splitId);
  await updateDoc(docRef, omitUndefined(data));
}

export async function deleteSplit(
  tripId: string,
  txId: string,
  splitId: string,
) {
  const docRef = firestoreDoc(splitsCol(tripId, txId), splitId);
  await deleteDoc(docRef);
}
