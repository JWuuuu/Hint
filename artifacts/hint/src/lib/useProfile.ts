import { useEffect, useState } from "react";
import { readBirthProfile, saveBirthProfileFromAccountProfile, getBirthProfileConflict } from "./astro/userBirthProfile";
import { birthDetailsError, birthInputFingerprint } from "./birthDetails";
/**
 * useProfile — the current anonymous user's saved identity. Returns the
 * profile (or null when none exists yet), loading state, and a save mutation
 * used by both onboarding and the Me edit flow.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  useSaveProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import type { Profile, ProfileInput } from "@workspace/api-client-react";
import { captureIdentityContext, getAnonId } from "./identity";

function localProfileKey(anonId: string) {
  return `hint_profile_v2_${anonId}`;
}

function readLocalProfile(anonId: string): Profile | null {
  try {
    const raw = window.localStorage.getItem(localProfileKey(anonId));
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

function writeLocalProfile(anonId: string, input: Omit<ProfileInput, "anonId">): Profile {
  const existing = readLocalProfile(anonId);
  const profile: Profile = {
    anonId,
    name: input.name,
    birthDate: input.birthDate,
    birthTime: input.birthTime ?? null,
    birthPlace: input.birthPlace ?? null,
    latitude: input.latitude ?? null, longitude: input.longitude ?? null, timezone: input.timezone ?? null, timezoneOffset: input.timezoneOffset ?? null,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(localProfileKey(anonId), JSON.stringify(profile));
  } catch {
    throw new Error("Profile could not be saved on this device");
  }

  return profile;
}

export function useProfile() {
  const anonId = getAnonId();
  const [storageStatus, setStorageStatus] = useState<"synced" | "local" | "unsaved">(() => readBirthProfile() ? "local" : "unsaved");
  const queryClient = useQueryClient();
  const queryKey = getGetProfileQueryKey({ anonId });

  const query = useQuery<Profile | null>({
    queryKey,
    queryFn: async () => {
      const identity = captureIdentityContext();
      if (identity.owner !== anonId) throw new DOMException("Local profile changed", "AbortError");
      try {
        const canonical = readBirthProfile();
        if (canonical) return { ...canonical, anonId };
        if (getBirthProfileConflict()) return null;
        const remote = await getProfile({ anonId });
        identity.assertCurrent();
        if (remote && !getBirthProfileConflict()) {
          const saved = saveBirthProfileFromAccountProfile(remote);
          return saved ? { ...saved, anonId } : { ...remote, anonId };
        }
        return remote ? { ...remote, anonId } : readLocalProfile(anonId);
      } catch (error) {
        identity.assertCurrent();
        if ((error as { name?: string })?.name === "AbortError") throw error;
        if ((error as { status?: number }).status === 404) {
          return readLocalProfile(anonId);
        }

        return readLocalProfile(anonId);
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useSaveProfile();

  const profile = query.data ?? null;
  const isMissing = query.isSuccess && query.data === null;

  useEffect(() => {
    const sync = () => {
      const current = readBirthProfile();
      queryClient.setQueryData(queryKey, current ? { ...current, anonId } : null);
    };
    window.addEventListener("hint.birthProfile.updated", sync);
    return () => window.removeEventListener("hint.birthProfile.updated", sync);
  }, [anonId, queryClient]);

  async function saveProfile(input: Omit<ProfileInput, "anonId">) {
    const identity = captureIdentityContext();
    if (identity.owner !== anonId) throw new DOMException("Local profile changed", "AbortError");
    if (birthDetailsError(input)) throw new Error("Invalid birth details");
    // Persist the canonical input before publishing it as saved in the UI.
    const birth = saveBirthProfileFromAccountProfile(input);
    if (!birth) throw new Error("Invalid birth details");
    const completeInput = { ...input, latitude: birth.latitude ?? null, longitude: birth.longitude ?? null,
      timezone: birth.timezone ?? null, timezoneOffset: birth.timezoneOffset ?? null };
    const local = writeLocalProfile(anonId, completeInput);
    queryClient.setQueryData(queryKey, local);
    setStorageStatus("local");
    try {
      const saved = await saveMutation.mutateAsync({ data: { ...completeInput, anonId } });
      identity.assertCurrent();
      const current = readBirthProfile();
      if (current && (current.updatedAt !== birth.updatedAt || current.name !== birth.name || birthInputFingerprint(current) !== birthInputFingerprint(birth))) return { ...current, anonId };
      if (current && birthInputFingerprint(current) === birthInputFingerprint(saved) && current.name === saved.name) queryClient.setQueryData(queryKey, { ...saved, anonId });
      setStorageStatus("synced");
      return { ...saved, anonId };
    } catch (error) {
      identity.assertCurrent();
      if ((error as { name?: string })?.name === "AbortError") throw error;
      return local;
    }
  }

  return {
    anonId,
    storageStatus,
    profile,
    isLoading: query.isLoading,
    isMissing,
    isError: query.isError,
    saveProfile,
    isSaving: saveMutation.isPending,
    refetch: query.refetch,
  };
}
