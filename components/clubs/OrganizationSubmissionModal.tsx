"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { universities, type UniversityId, type UniversityTheme } from "@/data/universities";
import { organizationCategories, type NewOrganizationSubmission, type OrganizationCategory } from "@/types/organization";
import { normalizeOrganizationHandle, suggestOrganizationHandle, type OrganizationSubmissionResult } from "@/lib/organizationIdentity";

type OrganizationSubmissionModalProps = {
  universityId: UniversityId;
  theme: UniversityTheme;
  onClose: () => void;
  onSubmit: (submission: NewOrganizationSubmission) => OrganizationSubmissionResult;
};

export function OrganizationSubmissionModal({ universityId, theme, onClose, onSubmit }: OrganizationSubmissionModalProps) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [category, setCategory] = useState<OrganizationCategory>("Other");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<OrganizationSubmissionResult | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !description.trim() || !contact.trim()) {
      setError("Add the organization name, description, and a contact method.");
      return;
    }
    const result = onSubmit({ universityId, name: name.trim(), handle, category, description: description.trim(), contact: contact.trim() });
    setSubmissionResult(result);
    if (!result.ok) {
      if (result.reason === "invalid_handle") setError("Use a club handle containing only lowercase letters, numbers, and single hyphens.");
      else if (result.reason === "invalid_name") setError("Add a valid organization name.");
      else setError(null);
    }
  }

  const conflict = submissionResult && !submissionResult.ok ? submissionResult : null;
  const existingHref = conflict?.reason === "name_conflict" && conflict.conflict.resolution === "open_existing"
    ? `/clubs/${conflict.conflict.record.handle}`
    : conflict?.reason === "handle_conflict" && conflict.record.recordStatus === "active"
      ? `/clubs/${conflict.record.handle}` : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="organization-submission-title" className="mx-auto my-6 max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>Community submission</p><h2 id="organization-submission-title" className="mt-1 text-2xl font-extrabold text-slate-950">Suggest an organization</h2><p className="mt-1 text-sm leading-6 text-slate-500">Suggestions remain pending until reviewed. They are never automatically marked official.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          <label className="block text-sm font-bold text-slate-700">Organization name<input value={name} maxLength={120} onChange={(event) => { const nextName = event.target.value; setName(nextName); setSubmissionResult(null); if (!handleEdited) setHandle(suggestOrganizationHandle(universityId, nextName)); }} className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
          <label className="block text-sm font-bold text-slate-700">Club handle<input value={handle} maxLength={64} onChange={(event) => { setHandleEdited(true); setHandle(normalizeOrganizationHandle(event.target.value)); setSubmissionResult(null); }} placeholder={`${universityId}-photography`} className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">Separate from personal usernames · /clubs/{handle || `${universityId}-club`}</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">University<input value={universities[universityId].name} readOnly className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-600" /></label>
            <label className="block text-sm font-bold text-slate-700">Category<select value={category} onChange={(event) => setCategory(event.target.value as OrganizationCategory)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal">{organizationCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="block text-sm font-bold text-slate-700">Description<textarea value={description} maxLength={1200} rows={5} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the organization and how a reviewer can verify it." className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
          <label className="block text-sm font-bold text-slate-700">Contact<input value={contact} maxLength={160} onChange={(event) => setContact(event.target.value)} placeholder="University email or another review contact" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><span className="font-bold">Pending review:</span> this local submission follows the same pending/community-verification model as Campus Data. It does not create a public club record.</div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          {conflict?.reason === "name_conflict" && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-black">This organization already exists.</p><p className="mt-1">{conflict.conflict.record.name}{conflict.conflict.match === "near" ? " is a possible near-duplicate." : " uses the same normalized name."}</p>{conflict.conflict.resolution === "pending_review" && <p className="mt-2 text-xs font-semibold">The existing submission is already pending review.</p>}{existingHref && <Link href={existingHref} className="mt-3 inline-flex rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Open existing club</Link>}{conflict.conflict.resolution === "request_reactivation" && <button type="button" disabled className="mt-3 rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-500">Request to reactivate/claim this club · Coming later</button>}</div>}
          {conflict?.reason === "handle_conflict" && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-black">That club handle is already in use.</p><p className="mt-1">Choose a different handle. Club handles do not share the personal username namespace.</p>{existingHref && <Link href={existingHref} className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-800">Open the club using this handle</Link>}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Cancel</button><button type="submit" className="rounded-xl px-5 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Submit for review</button></div>
        </form>
      </div>
    </div>
  );
}
