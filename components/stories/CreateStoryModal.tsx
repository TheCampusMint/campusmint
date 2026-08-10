import { useState, type FormEvent } from "react";

import {
  getCampusName,
  type UniversityId,
  type UniversityTheme,
} from "@/data/universities";
import { getVisibleAudienceOptions } from "@/lib/storyPermissions";
import {
  storyCategories,
  type Story,
  type StoryAudience,
  type StoryCategory,
} from "@/types/story";
import type { TemporaryUser } from "@/types/user";

type CreateStoryModalProps = {
  currentUser: TemporaryUser;
  theme: UniversityTheme;
  onClose: () => void;
  onCreate: (story: Story) => void;
};

export function CreateStoryModal({
  currentUser,
  theme,
  onClose,
  onCreate,
}: CreateStoryModalProps) {
  const audienceOptions = getVisibleAudienceOptions(currentUser.role);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<StoryCategory>("Campus Life");
  const [audience, setAudience] = useState<StoryAudience>(
    audienceOptions[0].id,
  );
  const [campus, setCampus] = useState<UniversityId>(
    currentUser.universityId,
  );

  function submitStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const createdAt = Date.now();
    const avatarPlaceholder = currentUser.firstName
      .split(/\s+/)
      .map((name) => name.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

    onCreate({
      id: `local-story-${globalThis.crypto.randomUUID()}`,
      authorUserId: currentUser.id,
      authorName: currentUser.firstName,
      authorUniversity: currentUser.universityId,
      authorRole: currentUser.role,
      avatarPlaceholder: avatarPlaceholder || "CM",
      contentType: "text",
      text: trimmedText,
      category,
      campus,
      audience,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(createdAt + 24 * 60 * 60 * 1000).toISOString(),
      likeCount: 0,
      commentCount: 0,
      likedByCurrentUser: false,
      comments: [],
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-story-title"
        className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div
          className="flex items-center justify-between gap-4 px-6 py-5"
          style={{
            backgroundColor: theme.primary,
            color: theme.secondary,
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
              Temporary local post
            </p>
            <h2 id="create-story-title" className="mt-1 text-2xl font-bold">
              Create Story
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-current px-3 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <form onSubmit={submitStory} className="space-y-5 p-6">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Text</span>
            <textarea
              required
              maxLength={500}
              rows={5}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="What's happening on campus?"
              className="mt-2 w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-current"
              style={{ color: "#0f172a" }}
            />
            <span className="mt-1 block text-right text-xs text-slate-400">
              {text.length}/500
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Category
              </span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as StoryCategory)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                {storyCategories.map((storyCategory) => (
                  <option key={storyCategory} value={storyCategory}>
                    {storyCategory}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Audience
              </span>
              <select
                value={audience}
                onChange={(event) =>
                  setAudience(event.target.value as StoryAudience)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                {audienceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Campus</span>
            <select
              value={campus}
              onChange={(event) =>
                setCampus(event.target.value as UniversityId)
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              <option value={currentUser.universityId}>
                {getCampusName(currentUser.universityId)}
              </option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              You can post only as your selected university. Cross-campus access
              does not allow impersonation.
            </span>
          </label>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Image and video uploads
            </p>
            <p className="mt-1 text-sm text-slate-500">Coming soon</p>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                backgroundColor: theme.primary,
                color: theme.secondary,
              }}
            >
              Post Story
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
