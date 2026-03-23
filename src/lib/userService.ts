import { db } from "./firebase";
import {
  collection,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

export interface UserProfile {
  id?: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt?: import("firebase/firestore").Timestamp;
  updatedAt?: import("firebase/firestore").Timestamp;
}

const usersCol = collection(db, "users");

function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export async function createUserProfile(
  profile: Omit<UserProfile, "createdAt" | "updatedAt">,
) {
  const now = Timestamp.now();
  if (profile.id) {
    const { id, ...data } = profile;
    await setDoc(firestoreDoc(usersCol, id), omitUndefined({
      ...data,
      createdAt: now,
      updatedAt: now,
    }));
    return id;
  }

  const docRef = await addDoc(usersCol, omitUndefined({
    ...profile,
    createdAt: now,
    updatedAt: now,
  }));
  return docRef.id;
}

export async function getUserProfile(userId: string) {
  const docRef = firestoreDoc(usersCol, userId);
  const snap = await getDoc(docRef);
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as UserProfile)
    : null;
}

export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfile>,
) {
  const docRef = firestoreDoc(usersCol, userId);
  await updateDoc(docRef, omitUndefined({ ...data, updatedAt: Timestamp.now() }));
}

export async function deleteUserProfile(userId: string) {
  const docRef = firestoreDoc(usersCol, userId);
  await deleteDoc(docRef);
}

export async function getAllUserProfiles() {
  const snap = await getDocs(usersCol);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserProfile[];
}
