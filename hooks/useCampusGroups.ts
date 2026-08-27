"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import { updateCampusGroupMembership } from "@/lib/groups/campusGroups";
import type { CampusGroup, CampusGroupStore } from "@/types/group";

export const CAMPUS_GROUPS_STORAGE_KEY =
  "campusmint:development-campus-groups:v1";

const emptyStore: CampusGroupStore = { version: 1, memberships: [] };

export function useCampusGroups(userId: string) {
  const [store, setStore] = useState<CampusGroupStore>(emptyStore);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(CAMPUS_GROUPS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CampusGroupStore;
        if (parsed?.version === 1 && Array.isArray(parsed.memberships)) {
          // Intentional client-only hydration for the local prototype store.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStore(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(CAMPUS_GROUPS_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CAMPUS_GROUPS_STORAGE_KEY, JSON.stringify(store));
  }, [hydrated, store]);

  function joinOrRequest(group: CampusGroup) {
    setStore((current) => ({
      ...current,
      memberships: updateCampusGroupMembership(
        current.memberships,
        group,
        userId,
        "join",
        new Date().toISOString(),
      ),
    }));
  }

  function leave(group: CampusGroup) {
    setStore((current) => ({
      ...current,
      memberships: updateCampusGroupMembership(
        current.memberships,
        group,
        userId,
        "leave",
        new Date().toISOString(),
      ),
    }));
  }

  function getStatus(groupId: string) {
    return (
      store.memberships.find(
        (membership) =>
          membership.groupId === groupId && membership.userId === userId,
      )?.status ?? "none"
    );
  }

  return {
    memberships: store.memberships,
    hydrated,
    joinOrRequest,
    leave,
    getStatus,
  };
}

export type CampusGroupsState = ReturnType<typeof useCampusGroups>;
