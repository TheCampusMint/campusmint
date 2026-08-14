"use client";

import { useState } from "react";

import { TactileButton } from "@/components/ui/TactileButton";

import { getAcademicCatalog } from "@/data/development/campusData";
import { getOrganizationsForUniversity } from "@/data/organizations";
import { getUserRoleLabel } from "@/data/userRoles";
import { universities, getAccountUniversityName } from "@/data/universities";
import type { CampusMintProfile, CampusMintUser } from "@/types/profile";

type EditProfileModalProps = {
  user: CampusMintUser;
  primaryColor: string;
  onSave: (profile: Partial<CampusMintProfile>) => { ok: boolean; error: string | null };
  onClose: () => void;
};

const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400";

export function EditProfileModal({ user, primaryColor, onSave, onClose }: EditProfileModalProps) {
  const [draft, setDraft] = useState(user.profile);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tutoringSubjects = [
    "Math",
    "Science",
    "English / Writing",
    "Business",
    "Engineering",
    "Languages",
    "Computer Science",
    "Other",
  ];
  const catalog = getAcademicCatalog(user.account.universityId);
  const organizations = getOrganizationsForUniversity(user.account.universityId);

  function toggleId(field: "classIds" | "clubIds", id: string) {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((currentId) => currentId !== id)
        : [...current[field], id],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-6" role="presentation">
      <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Your public information</p><h2 id="edit-profile-title" className="mt-1 text-2xl font-black text-slate-950">Edit profile</h2></div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Account identity — not editable here</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {getAccountUniversityName(user.account)}
            {" · "}
            {getUserRoleLabel(user.account.role)}
          </p>
          <p className="mt-1 text-xs text-slate-500">University, role, and verification are controlled by account identity.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">First name<input className={inputClass} value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></label>
          <label className="text-sm font-semibold text-slate-700">Last name<input className={inputClass} value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Display name<input className={inputClass} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Campus Mint username<input className={inputClass} value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">Globally unique; letters, numbers, underscores, and periods.</span></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Bio<textarea rows={3} className={inputClass} value={draft.bio ?? ""} onChange={(event) => setDraft({ ...draft, bio: event.target.value || null })} /></label>
          <label className="text-sm font-semibold text-slate-700">
            Major
            <input
              className={inputClass}
              value={draft.major ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  major: event.target.value || null,
                })
              }
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Academic area
            <input
              className={inputClass}
              value={draft.academicArea ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  academicArea:
                    event.target.value || null,
                })
              }
              placeholder="Engineering, Business, Biology..."
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Graduation year
            <input
              type="number"
              min="1990"
              max="2100"
              className={inputClass}
              value={draft.graduationYear ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  graduationYear:
                    event.target.value
                      ? Number(event.target.value)
                      : null,
                })
              }
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Hometown
            <input
              className={inputClass}
              value={draft.hometown ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  hometown: event.target.value || null,
                })
              }
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Avatar placeholder
            <select
              className={inputClass}
              value={draft.photo.placeholderId ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  photo: {
                    kind: "development_placeholder",
                    placeholderId: event.target.value,
                    storagePath: null,
                  },
                })
              }
            >
              <option value="CS">CS</option>
              <option value="CM">CM</option>
              <option value="ST">ST</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Interests, comma separated
            <input
              className={inputClass}
              value={draft.interests.join(", ")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  interests: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Hobbies, comma separated
            <input
              className={inputClass}
              value={(draft.hobbies ?? []).join(", ")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  hobbies: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">LinkedIn URL<input type="url" className={inputClass} value={draft.linkedin ?? ""} onChange={(event) => setDraft({ ...draft, linkedin: event.target.value || null })} /></label>
          <label className="text-sm font-semibold text-slate-700">Instagram URL<input type="url" className={inputClass} value={draft.instagram ?? ""} onChange={(event) => setDraft({ ...draft, instagram: event.target.value || null })} /></label>
          <label className="text-sm font-semibold text-slate-700">Portfolio URL<input type="url" className={inputClass} value={draft.portfolioUrl ?? ""} onChange={(event) => setDraft({ ...draft, portfolioUrl: event.target.value || null })} /></label>
          <label className="text-sm font-semibold text-slate-700">Personal website<input type="url" className={inputClass} value={draft.personalWebsite ?? ""} onChange={(event) => setDraft({ ...draft, personalWebsite: event.target.value || null })} /></label>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Roommate discovery
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Appear when students search for roommates.
                </p>
              </div>

              <TactileButton
                type="button"
                selected={Boolean(
                  draft.lookingForRoommate,
                )}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    lookingForRoommate:
                      !current.lookingForRoommate,
                    roommatePreferences:
                      current.lookingForRoommate
                        ? []
                        : current.roommatePreferences ?? [],
                  }))
                }
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  draft.lookingForRoommate
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {draft.lookingForRoommate
                  ? "On"
                  : "Off"}
              </TactileButton>
            </div>

            {draft.lookingForRoommate && (
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Preferences
                <input
                  className={inputClass}
                  value={(
                    draft.roommatePreferences ?? []
                  ).join(", ")}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      roommatePreferences:
                        event.target.value
                          .split(",")
                          .map((value) =>
                            value.trim(),
                          )
                          .filter(Boolean),
                    })
                  }
                  placeholder="Quiet, pets okay, early riser..."
                />
              </label>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Tutoring
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Let students find you by broad subject.
                </p>
              </div>

              <TactileButton
                type="button"
                selected={Boolean(
                  draft.offersTutoring,
                )}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    offersTutoring:
                      !current.offersTutoring,
                    tutoringSubjects:
                      current.offersTutoring
                        ? []
                        : current.tutoringSubjects ?? [],
                  }))
                }
                className={`rounded-full px-4 py-2 text-xs font-black ${
                  draft.offersTutoring
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {draft.offersTutoring
                  ? "On"
                  : "Off"}
              </TactileButton>
            </div>

            {draft.offersTutoring && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tutoringSubjects.map((subject) => {
                  const selected = (
                    draft.tutoringSubjects ?? []
                  ).includes(subject);

                  return (
                    <TactileButton
                      key={subject}
                      type="button"
                      selected={selected}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          tutoringSubjects: selected
                            ? (
                                current.tutoringSubjects ??
                                []
                              ).filter(
                                (item) =>
                                  item !== subject,
                              )
                            : [
                                ...(
                                  current.tutoringSubjects ??
                                  []
                                ),
                                subject,
                              ],
                        }))
                      }
                      className={`rounded-full border px-3 py-2 text-xs font-bold ${
                        selected
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {subject}
                    </TactileButton>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {catalog.courses.length > 0 && <fieldset className="mt-6"><legend className="text-sm font-bold text-slate-900">Classes</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{catalog.courses.slice(0, 8).map((course) => <label key={course.id} className="flex gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={draft.classIds.includes(course.id)} onChange={() => toggleId("classIds", course.id)} /><span>{course.subjectCode} {course.courseNumber} · {course.title}</span></label>)}</div></fieldset>}
        {organizations.length > 0 && <fieldset className="mt-6"><legend className="text-sm font-bold text-slate-900">Clubs</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{organizations.map((organization) => <label key={organization.id} className="flex gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={draft.clubIds.includes(organization.id)} onChange={() => toggleId("clubIds", organization.id)} /><span>{organization.name}</span></label>)}</div></fieldset>}

        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Photo uploads are not enabled yet. The profile model already separates a future storage path from development placeholders.</p>
        {saveError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{saveError}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button type="button" onClick={() => { const result = onSave(draft); if (result.ok) onClose(); else setSaveError(result.error); }} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>Save profile</button></div>
      </section>
    </div>
  );
}
