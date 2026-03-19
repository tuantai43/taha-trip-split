import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { supabase } from "@/lib/supabase";
import {
  startAutoSync,
  stopAutoSync,
  syncAll,
  syncStatus,
  lastSyncError,
} from "@/lib/syncService";
import { db } from "@/db/database";
import { useTripStore } from "@/stores/tripStore";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const loading = ref(true);

  const isAuthenticated = computed(() => !!user.value);
  const displayName = computed(
    () =>
      profile.value?.display_name ??
      user.value?.user_metadata?.["full_name"] ??
      "Khách",
  );

  async function init() {
    loading.value = true;
    try {
      const { data } = await supabase.auth.getSession();
      user.value = data?.session?.user ?? null;
      if (user.value) {
        await fetchProfile();
        await claimOfflineData(user.value.id);
        startAutoSync(user.value.id);
      }
    } catch {
      // Supabase not configured — offline mode
    }
    loading.value = false;

    try {
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const prev = user.value;
        user.value = session?.user ?? null;
        if (session?.user) {
          await fetchProfile();
          if (!prev) {
            // Just logged in
            await claimOfflineData(session.user.id);
            startAutoSync(session.user.id);
          }
        } else {
          profile.value = null;
          stopAutoSync();
        }
      });
    } catch {
      // Supabase not configured — offline mode
    }
  }

  async function fetchProfile() {
    if (!user.value) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.value.id)
      .single();
    if (data) profile.value = data;
  }

  // Claim local offline data: update createdBy from "local" to real userId
  async function claimOfflineData(userId: string) {
    const localTrips = await db.trips
      .where("createdBy")
      .equals("local")
      .toArray();
    for (const trip of localTrips) {
      await db.trips.update(trip.id, {
        createdBy: userId,
        _syncStatus: "pending",
        _syncAction: "create",
      });
    }

    const localMembers = await db.tripMembers.toArray();
    for (const m of localMembers) {
      if (m.role === "owner" && !m.userId) {
        await db.tripMembers.update(m.id, {
          userId,
          _syncStatus: "pending",
          _syncAction: m._syncAction ?? "update",
        });
      }
    }

    const localTx = await db.transactions
      .where("_syncStatus")
      .equals("pending")
      .toArray();
    for (const tx of localTx) {
      if (tx.createdBy === "local") {
        await db.transactions.update(tx.id, { createdBy: userId });
      }
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  }

  async function signInWithFacebook() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signUpWithEmail(
    email: string,
    password: string,
    displayName: string,
  ) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    if (error) throw error;
  }

  async function signOut() {
    stopAutoSync();
    await supabase.auth.signOut();
    // Clear all local Dexie data
    await Promise.all([
      db.trips.clear(),
      db.tripMembers.clear(),
      db.transactions.clear(),
      db.transactionSplits.clear(),
      db.settlements.clear(),
      db.syncQueue.clear(),
    ]);
    // Reset in-memory state
    const tripStore = useTripStore();
    tripStore.$reset();
    user.value = null;
    profile.value = null;
  }

  async function triggerSync() {
    if (user.value) {
      await syncAll(user.value.id);
    }
  }

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    displayName,
    syncStatus,
    lastSyncError,
    init,
    signInWithGoogle,
    signInWithFacebook,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    triggerSync,
  };
});
