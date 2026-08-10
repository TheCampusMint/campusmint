"use client";

import { useState } from "react";

import { getCampusDataCounts, getCampusDataSources } from "@/data/development/campusData";
import type { UniversityId } from "@/data/universities";

export function CampusDataDebugPanel({ universityId, localPendingCount }: {
  universityId: UniversityId;
  localPendingCount: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const sources = getCampusDataSources(universityId);
  const counts = getCampusDataCounts(universityId, localPendingCount);

  async function runSync(sourceId: string) {
    setRunningId(sourceId); setMessage(null);
    try {
      const response = await fetch("/api/campus-data/sync", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceId }),
      });
      const result = await response.json() as { error?: string; mode?: string; created?: number; message?: string };
      setMessage(result.error ?? `${result.mode}: ${result.created ?? 0} records validated. ${result.message ?? ""}`);
    } catch {
      setMessage("The local sync trigger could not be reached.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <details className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
      <summary className="cursor-pointer font-semibold text-violet-950">Dev: Campus data diagnostics</summary>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(counts).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white p-3">
              <p className="text-xl font-bold text-violet-950">{value}</p>
              <p className="break-words text-[11px] capitalize text-slate-500">{label.replace(/([A-Z])/g, " $1")}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {sources.length === 0 && <p className="text-sm text-slate-600">No sources are registered for this university yet.</p>}
          {sources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{source.name}</p>
                <p className="text-xs text-slate-500">
                  {source.enabled ? "Enabled" : "Disabled"} · {source.refreshInterval} · Last sync: {source.lastSuccessfulSync ?? "Never"}
                </p>
              </div>
              <button
                type="button"
                disabled={!source.enabled || runningId === source.id}
                onClick={() => runSync(source.id)}
                className="rounded-lg bg-violet-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {runningId === source.id ? "Running…" : "Run manual sync"}
              </button>
            </div>
          ))}
        </div>
        {message && <p role="status" className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{message}</p>}
      </div>
    </details>
  );
}
