import { db } from "@/db/database";
import { getFirebaseAuthErrorMessage } from "@/lib/authError";
import { auth } from "@/lib/firebase";
import {
  startGuestImportMonitor,
  stopGuestImportMonitor,
} from "@/lib/guestImportService";
import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from "@/lib/userService";
import { useTripStore } from "@/stores/tripStore";
import type { Profile } from "@/types";
import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type User,
} from "firebase/auth";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const loading = ref(true);
  const linkingGoogle = ref(false);
  const linkingPassword = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const authProviders = computed(() =>
    user.value?.providerData.map((provider) => provider.providerId) ?? [],
  );
  const isGoogleLinked = computed(() =>
    authProviders.value.includes("google.com"),
  );
  const isPasswordLinked = computed(() =>
    authProviders.value.includes("password"),
  );
  const displayName = computed(
    () =>
      profile.value?.display_name ??
      user.value?.displayName ??
      "Khách",
  );

  let initialized = false;

  async function init() {
    if (initialized) return;
    loading.value = true;
    onAuthStateChanged(auth, async (nextUser) => {
      const prevUserId = user.value?.uid;
      user.value = nextUser;
      if (nextUser) {
        await fetchProfile();
        if (!prevUserId || prevUserId !== nextUser.uid) {
          startGuestImportMonitor(nextUser.uid);
        }
      } else {
        profile.value = null;
        stopGuestImportMonitor();
      }

      if (!initialized) {
        initialized = true;
        loading.value = false;
      }
    });
  }

  async function fetchProfile() {
    if (!user.value) return;
    const remoteProfile = await getUserProfile(user.value.uid);

    if (!remoteProfile) {
      const fallbackName = user.value.displayName ?? user.value.email ?? "Khách";
      await createUserProfile({
        id: user.value.uid,
        email: user.value.email ?? "",
        displayName: fallbackName,
        avatarUrl: user.value.photoURL ?? undefined,
      });
      profile.value = {
        id: user.value.uid,
        email: user.value.email ?? "",
        display_name: fallbackName,
        avatar_url: user.value.photoURL,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return;
    }

    profile.value = {
      id: user.value.uid,
      email: remoteProfile.email,
      display_name: remoteProfile.displayName,
      avatar_url: remoteProfile.avatarUrl ?? null,
      created_at: remoteProfile.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
      updated_at: remoteProfile.updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
    };
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function signInWithFacebook() {
    const provider = new FacebookAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function getSignInMethods(email: string) {
    return fetchSignInMethodsForEmail(auth, email.trim());
  }

  async function signUpWithEmail(
    email: string,
    password: string,
    displayName: string,
  ) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateFirebaseProfile(credential.user, { displayName });
    await createUserProfile({
      id: credential.user.uid,
      email,
      displayName,
      avatarUrl: credential.user.photoURL ?? undefined,
    });
    profile.value = {
      id: credential.user.uid,
      email,
      display_name: displayName,
      avatar_url: credential.user.photoURL,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function signOut() {
    stopGuestImportMonitor();
    await firebaseSignOut(auth);
    // Clear all local Dexie data
    await Promise.all([
      db.trips.clear(),
      db.tripMembers.clear(),
      db.transactions.clear(),
      db.transactionSplits.clear(),
      db.settlements.clear(),
    ]);
    // Reset in-memory state
    const tripStore = useTripStore();
    tripStore.reset();
    user.value = null;
    profile.value = null;
  }

  async function linkGoogleAccount() {
    if (!user.value) return;
    linkingGoogle.value = true;
    try {
      const provider = new GoogleAuthProvider();
      const result = await linkWithPopup(user.value, provider);
      user.value = result.user;
      await updateProfileDocument();
      await fetchProfile();
    } finally {
      linkingGoogle.value = false;
    }
  }

  async function linkPasswordAccount(password: string) {
    if (!user.value?.email) return;
    linkingPassword.value = true;
    try {
      const credential = EmailAuthProvider.credential(user.value.email, password);
      const result = await linkWithCredential(user.value, credential);
      user.value = result.user;
      await fetchProfile();
    } finally {
      linkingPassword.value = false;
    }
  }

  async function updateProfileDocument() {
    if (!user.value) return;
    const nextDisplayName = user.value.displayName ?? user.value.email ?? "Khách";
    const remoteProfile = await getUserProfile(user.value.uid);
    if (!remoteProfile) {
      await createUserProfile({
        id: user.value.uid,
        email: user.value.email ?? "",
        displayName: nextDisplayName,
        avatarUrl: user.value.photoURL ?? undefined,
      });
      return;
    }

    await updateUserProfile(user.value.uid, {
      email: user.value.email ?? remoteProfile.email,
      displayName: nextDisplayName,
      avatarUrl: user.value.photoURL ?? remoteProfile.avatarUrl,
    });
  }

  return {
    user,
    profile,
    loading,
    linkingGoogle,
    linkingPassword,
    isAuthenticated,
    authProviders,
    isGoogleLinked,
    isPasswordLinked,
    displayName,
    init,
    signInWithGoogle,
    signInWithFacebook,
    signInWithEmail,
    getSignInMethods,
    signUpWithEmail,
    signOut,
    linkGoogleAccount,
    linkPasswordAccount,
    updateProfileDocument,
    getFirebaseAuthErrorMessage,
  };
});
