"use client";

import { useState, type FormEvent } from "react";

import { universities, type UniversityId, type UniversityTheme } from "@/data/universities";
import { organizationCategories, type NewOrganizationSubmission, type OrganizationCategory } from "@/types/organization";

type OrganizationSubmissionModalProps = {
  universityId: UniversityId;
  theme: UniversityTheme;
  onClose: () => void;
  onSubmit: (submission: NewOrganizationSubmission) => void;
};

export function OrganizationSubmissionModal({ universityId, theme, onClose, onSubmit }: OrganizationSubmissionModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OrganizationCategory>("Other");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !description.trim() || !contact.trim()) {
      setError("Add the organization name, description, and a contact method.");
      return;
    }
    onSubmit({ universityId, name: name.trim(), category, description: description.trim(), contact: contact.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="organization-submission-title" className="mx-auto my-6 max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>Community submission</p><h2 id="organization-submission-title" className="mt-1 text-2xl font-extrabold text-slate-950">Suggest an organization</h2><p className="mt-1 text-sm leading-6 text-slate-500">Suggestions remain pending until reviewed. They are never automatically marked official.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          <label className="block text-sm font-bold text-slate-700">Organization name<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">University<input value={universities[universityId].name} readOnly className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-600" /></label>
            <label className="block text-sm font-bold text-slate-700">Category<select value={category} onChange={(event) => setCategory(event.target.value as OrganizationCategory)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal">{organizationCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="block text-sm font-bold text-slate-700">Description<textarea value={description} maxLength={1200} rows={5} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the organization and how a reviewer can verify it." className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
          <label className="block text-sm font-bold text-slate-700">Contact<input value={contact} maxLength={160} onChange={(event) => setContact(event.target.value)} placeholder="University email or another review contact" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><span className="font-bold">Pending review:</span> this local submission follows the same pending/community-verification model as Campus Data. It does not create a public club record.</div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Cancel</button><button type="submit" className="rounded-xl px-5 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Submit for review</button></div>
        </form>
      </div>
    </div>
  );
}
