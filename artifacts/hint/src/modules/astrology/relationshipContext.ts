import { useEffect, useRef } from "react";
import { captureIdentityContext, getAnonId } from "@/lib/identity";
import { historyClearVersion } from "@/lib/clearHistory";

/** A response belongs to the owner and history generation that requested it. */
export function captureRelationshipContext() {
  const identity = captureIdentityContext();
  const version = historyClearVersion(identity.owner);
  return {
    owner: identity.owner,
    isCurrent: () => {
      try { identity.assertCurrent(); return historyClearVersion(identity.owner) === version; }
      catch { return false; }
    },
  };
}

/** Clear open content without automatically refetching what was just removed. */
export function useRelationshipReset(onReset: () => void) {
  const callback = useRef(onReset); callback.current = onReset;
  useEffect(() => {
    let owner = getAnonId();
    let version = historyClearVersion(owner);
    const identity = captureIdentityContext();
    let identityInvalidated = false;
    const check = () => {
      const nextOwner = getAnonId();
      const nextVersion = historyClearVersion(nextOwner);
      let invalid = false;
      try { identity.assertCurrent(); } catch { invalid = true; }
      if (owner === nextOwner && version === nextVersion && (!invalid || identityInvalidated)) return;
      owner = nextOwner; version = nextVersion; identityInvalidated = invalid; callback.current();
    };
    identity.signal.addEventListener("abort", check);
    window.addEventListener("storage", check);
    window.addEventListener("hint:identity-changed", check);
    window.addEventListener("pageshow", check);
    return () => {
      identity.signal.removeEventListener("abort", check);
      window.removeEventListener("storage", check);
      window.removeEventListener("hint:identity-changed", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);
}
