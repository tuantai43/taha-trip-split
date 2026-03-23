import { db } from "./firebase";
import {
  collection,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

// Trip type
export interface Trip {
  id?: string;
  name: string;
  description?: string;
  currencyCode: string;
  status: "draft" | "active" | "settled" | "archived";
  startDate?: string;
  endDate?: string;
  inviteCode?: string;
  shareEnabled: boolean;
  shareToken?: string;
  createdBy: string;
  createdAt?: import("firebase/firestore").Timestamp;
  updatedAt?: import("firebase/firestore").Timestamp;
}

const tripsCol = collection(db, "trips");

function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export async function createTrip(
  trip: Omit<Trip, "createdAt" | "updatedAt">,
) {
  const now = Timestamp.now();
  if (trip.id) {
    const { id, ...data } = trip;
    await setDoc(firestoreDoc(tripsCol, id), omitUndefined({
      ...data,
      createdAt: now,
      updatedAt: now,
    }));
    return id;
  }

  const docRef = await addDoc(tripsCol, omitUndefined({
    ...trip,
    createdAt: now,
    updatedAt: now,
  }));
  return docRef.id;
}

export async function getTrip(tripId: string) {
  const docRef = firestoreDoc(tripsCol, tripId);
  const snap = await getDoc(docRef);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Trip) : null;
}

export async function updateTrip(tripId: string, data: Partial<Trip>) {
  const docRef = firestoreDoc(tripsCol, tripId);
  await updateDoc(docRef, omitUndefined({ ...data, updatedAt: Timestamp.now() }));
}

export async function deleteTrip(tripId: string) {
  const docRef = firestoreDoc(tripsCol, tripId);
  await deleteDoc(docRef);
}

export async function getMyTrips(userId: string) {
  const q = query(tripsCol, where("createdBy", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Trip[];
}

export function subscribeMyTrips(
  userId: string,
  callback: (trips: Trip[]) => void,
) {
  const q = query(tripsCol, where("createdBy", "==", userId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Trip[]);
  });
}

export function subscribeTrip(
  tripId: string,
  callback: (trip: Trip | null) => void,
) {
  return onSnapshot(firestoreDoc(tripsCol, tripId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Trip) : null);
  });
}

export async function getSharedTrip(inviteCode: string) {
  const q = query(
    tripsCol,
    where("inviteCode", "==", inviteCode),
    where("shareEnabled", "==", true),
  );
  const snap = await getDocs(q);
  const tripDoc = snap.docs[0];
  if (!tripDoc) return null;
  return { id: tripDoc.id, ...tripDoc.data() } as Trip;
}
