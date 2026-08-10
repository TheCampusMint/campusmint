"use client";

import { useState } from "react";

import {
  profilePrivacyFields,
  profileVisibilityOptions,
  type ProfilePrivacySettings,
} from "@/types/profile";

type ProfilePrivacyModalProps = {
  settings: ProfilePrivacySettings;
  primaryColor: string;
  onSave: (settings: ProfilePrivacySettings) => void;
  onClose: () => void;
};

const fieldLabels: Record<keyof ProfilePrivacySettings, string> = {
  bio: "Bio",
  major: "Major",
  graduationYear: "Graduation year",
  classes: "Classes",
  clubs: "Clubs",
  interests: "Interests",
  hometown: "Hometown",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  portfolioUrl: "Portfolio",
  personalWebsite: "Personal website",
};

export function ProfilePrivacyModal({ settings, primaryColor, onSave, onClose }: ProfilePrivacyModalProps) {
  const [draft, setDraft] = useState(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6" role="presentation">
      <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Field-level controls</p>
            <h2 id="privacy-title" className="mt-1 text-2xl font-black text-slate-950">Profile privacy</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Search and profile views use the same permission helpers, so hidden fields are not used to reveal you in results.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
        </div>

        <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {profilePrivacyFields.map((field) => (
            <label key={field} className="flex items-center justify-between gap-4 p-4">
              <span className="text-sm font-semibold text-slate-800">{fieldLabels[field]}</span>
              <select
                value={draft[field]}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                className="min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {profileVisibilityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
          <button type="button" onClick={() => { onSave(draft); onClose(); }} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>Save privacy</button>
        </div>
      </section>
    </div>
  );
}
