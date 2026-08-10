import { useState } from "react";

import { CommentsSection } from "@/components/stories/CommentsSection";
import { getOrganizationById } from "@/data/organizations";
import { getUserRoleLabel } from "@/data/userRoles";
import {
  getCampusName,
  type UniversityTheme,
} from "@/data/universities";
import {
  formatStoryAge,
  getAudienceLabel,
} from "@/lib/storyPermissions";
import type { Story } from "@/types/story";

type StoryCardProps = {
  story: Story;
  currentTime: number;
  theme: UniversityTheme;
  onToggleLike: (storyId: Story["id"]) => void;
  onAddComment: (storyId: Story["id"], text: string) => void;
  onOpenProfile?: (userId: string) => void;
};

export function StoryCard({
  story,
  currentTime,
  theme,
  onToggleLike,
  onAddComment,
  onOpenProfile,
}: StoryCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const organization = getOrganizationById(story.organizationId);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          {story.authorUserId && onOpenProfile ? (
            <button
              type="button"
              aria-label={`Open ${story.authorName}'s profile`}
              onClick={() => onOpenProfile(story.authorUserId!)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: theme.accent, color: theme.primary, outlineColor: theme.primary }}
            >
              {story.avatarPlaceholder}
            </button>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>
              {story.avatarPlaceholder}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {story.authorUserId && onOpenProfile ? (
                <button type="button" onClick={() => onOpenProfile(story.authorUserId!)} className="font-bold text-slate-950 hover:underline">
                  {story.authorName}
                </button>
              ) : <h3 className="font-bold text-slate-950">{story.authorName}</h3>}
              <span className="text-xs text-slate-400">•</span>
              <span className="text-sm text-slate-500">
                {formatStoryAge(story.createdAt, currentTime)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {getCampusName(story.authorUniversity)} ·{" "}
              {getUserRoleLabel(story.authorRole)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: theme.accent,
              color: theme.primary,
            }}
          >
            {story.category}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {getAudienceLabel(story.audience)}
          </span>
        </div>

        {organization && <p className="mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: theme.primary }}>Posted for {organization.name}</p>}

        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
          {story.text}
        </p>

        {story.contentType === "image-placeholder" &&
          story.imagePlaceholder && (
            <div
              className="mt-5 flex aspect-video items-center justify-center rounded-2xl border border-white/50 p-6 text-center"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
                color: theme.secondary,
              }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
                  Media placeholder
                </p>
                <p className="mt-2 font-semibold">{story.imagePlaceholder}</p>
              </div>
            </div>
          )}
      </div>

      <div className="grid grid-cols-3 border-t border-slate-100 px-2 py-2 sm:px-4">
        <button
          type="button"
          aria-pressed={story.likedByCurrentUser}
          onClick={() => onToggleLike(story.id)}
          className="rounded-xl px-2 py-3 text-sm font-semibold transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            color: story.likedByCurrentUser ? theme.primary : "#475569",
            outlineColor: theme.primary,
          }}
        >
          {story.likedByCurrentUser ? "Liked" : "Like"} ·{" "}
          {story.likeCount.toLocaleString("en-US")}
        </button>
        <button
          type="button"
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((isOpen) => !isOpen)}
          className="rounded-xl px-2 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: theme.primary }}
        >
          Comments · {story.commentCount.toLocaleString("en-US")}
        </button>
        <button
          type="button"
          disabled
          title="Sharing is coming soon"
          className="rounded-xl px-2 py-3 text-sm font-semibold text-slate-400"
        >
          Share
        </button>
      </div>

      {commentsOpen && (
        <CommentsSection
          storyId={story.id}
          comments={story.comments}
          currentTime={currentTime}
          theme={theme}
          onAddComment={(text) => onAddComment(story.id, text)}
        />
      )}
    </article>
  );
}
