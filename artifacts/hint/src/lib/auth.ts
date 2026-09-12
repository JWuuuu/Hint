import { useEffect, useState } from "react";
import { captureIdentityContext, localAccountStorageKey } from "./identity";

const AUTH_STORAGE_KEY = "hint_local_auth_v1";
const AUTH_UPDATED_EVENT = "hint:local-auth-updated";

export type LocalAccount = {
  identifier: string;
  provider: "email" | "phone" | "google" | "apple" | "facebook";
  email?: string;
  phone?: string;
  name?: string;
  verifiedAt?: string;
  createdAt: string;
  lastSignedInAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/[^\d+]/g, "");
}

function normalizeIdentifier(input: { provider: LocalAccount["provider"]; identifier: string }) {
  if (input.provider === "email") return normalizeEmail(input.identifier);
  if (input.provider === "phone") return normalizePhone(input.identifier);
  return input.identifier.trim();
}

export function getLocalAccount(): LocalAccount | null {
  try {
    const identity = captureIdentityContext();
    const ownedKey = localAccountStorageKey(identity.owner);
    const owned = window.localStorage.getItem(ownedKey);
    const raw = owned ?? window.localStorage.getItem(AUTH_STORAGE_KEY);
    identity.assertCurrent();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAccount & { email?: string };
    if (!parsed) return null; // An owned null tombstone prevents legacy sign-in resurrection.
    if (owned === null) {
      // Only stable, currently selected legacy bytes can be adopted. Preserve
      // the original for recovery; all future writes use the captured owner.
      try { window.localStorage.setItem(ownedKey, raw); } catch { /* The legacy record remains durable and readable. */ }
      identity.assertCurrent();
    }
    if (!parsed.identifier && parsed.email) {
      return {
        ...parsed,
        identifier: normalizeEmail(parsed.email),
        provider: "email",
        email: normalizeEmail(parsed.email),
      };
    }
    return parsed as LocalAccount;
  } catch {
    return null;
  }
}

export function saveLocalAccount(input: {
  identifier: string;
  provider: LocalAccount["provider"];
  email?: string;
  phone?: string;
  name?: string;
  verifiedAt?: string;
}): LocalAccount {
  const identity = captureIdentityContext();
  const previous = getLocalAccount();
  const now = new Date().toISOString();
  const identifier = normalizeIdentifier(input);
  const existing = previous?.identifier === identifier && previous.provider === input.provider ? previous : null;
  const account: LocalAccount = {
    identifier,
    provider: input.provider,
    email: input.email ? normalizeEmail(input.email) : input.provider === "email" ? identifier : undefined,
    phone: input.phone ? normalizePhone(input.phone) : input.provider === "phone" ? identifier : undefined,
    name: input.name?.trim() || existing?.name || undefined,
    verifiedAt: input.verifiedAt ?? existing?.verifiedAt ?? now,
    createdAt: existing?.createdAt ?? now,
    lastSignedInAt: now,
  };

  // Publish a saved account only after the write succeeds. Callers retain their
  // form and display a retry message when storage is unavailable.
  identity.assertCurrent();
  window.localStorage.setItem(localAccountStorageKey(identity.owner), JSON.stringify(account));
  identity.assertCurrent();
  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));

  return account;
}

export function clearLocalAccount() {
  const identity = captureIdentityContext();
  window.localStorage.setItem(localAccountStorageKey(identity.owner), "null");
  identity.assertCurrent();
  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT));
}

export function useLocalAccount() {
  const [account, setAccount] = useState<LocalAccount | null>(getLocalAccount);

  useEffect(() => {
    const sync = () => setAccount(getLocalAccount());
    window.addEventListener(AUTH_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return account;
}
