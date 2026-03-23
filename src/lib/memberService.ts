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

export interface Member {
  id?: string;
  userId?: string;
  displayName: string;
  role: "owner" | "member";
  isGuest: boolean;
  claimedBy?: string;
  claimedAt?: import("firebase/firestore").Timestamp;
  joinedAt?: import("firebase/firestore").Timestamp;
}

export function membersCol(tripId: string) {
  return collection(db, `trips/${tripId}/members`);
}

function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export async function addMember(
  tripId: string,
  member: Omit<Member, "joinedAt">,
) {
  const now = Timestamp.now();
  if (member.id) {
    const { id, ...data } = member;
    await setDoc(firestoreDoc(membersCol(tripId), id), omitUndefined({
      ...data,
      joinedAt: now,
    }));
    return id;
  }

  const docRef = await addDoc(membersCol(tripId), omitUndefined({
    ...member,
    joinedAt: now,
  }));
  return docRef.id;
}

export async function getMembers(tripId: string) {
  const snap = await getDocs(membersCol(tripId));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Member[];
}

export function subscribeMembers(
  tripId: string,
  callback: (members: Member[]) => void,
) {
  return onSnapshot(membersCol(tripId), (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Member[]);
  });
}

export async function updateMember(
  tripId: string,
  memberId: string,
  data: Partial<Member>,
) {
  const docRef = firestoreDoc(membersCol(tripId), memberId);
  await updateDoc(docRef, omitUndefined(data));
}

export async function deleteMember(tripId: string, memberId: string) {
  const docRef = firestoreDoc(membersCol(tripId), memberId);
  await deleteDoc(docRef);
}
