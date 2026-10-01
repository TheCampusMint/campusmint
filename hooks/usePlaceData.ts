"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchPlaceJson, refreshPlaceSession, requestPlaceSession } from "@/lib/providers/places/session";
/** Request only after an explicit detail expansion or first viewport intersection. */
export function usePlaceData<T>(sessionKey: string, key: string, url: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  const [revision, setRevision] = useState(0);
  const scopedKey = `${sessionKey}:${key}`;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    requestPlaceSession(sessionKey, key, () => fetchPlaceJson<T>(url))
      .then(data => { if (active) setState({ key: scopedKey, data }); })
      .catch(error => { if (active) setState({ key: scopedKey, error: error.message }); });
    // Deliberately don't abort the shared request when one subscriber unmounts.
    return () => { active = false; };
  }, [enabled, sessionKey, key, scopedKey, url, revision]);
  const refresh = useCallback(() => { refreshPlaceSession(sessionKey, key); setRevision(n => n + 1); }, [sessionKey, key]);
  return { data: state.key === scopedKey ? state.data : undefined, error: state.key === scopedKey ? state.error : undefined, refresh };
}
