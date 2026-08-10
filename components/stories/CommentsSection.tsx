import { useState, type FormEvent } from "react";

import type { UniversityTheme } from "@/data/universities";
import { formatStoryAge } from "@/lib/storyPermissions";
import type { Story, StoryComment } from "@/types/story";

type CommentsSectionProps = {
  storyId: Story["id"];
  comments: StoryComment[];
  currentTime: number;
  theme: UniversityTheme;
  onAddComment: (text: string) => void;
};

export function CommentsSection({
  storyId,
  comments,
  currentTime,
  theme,
  onAddComment,
}: CommentsSectionProps) {
  const [commentText, setCommentText] = useState("");
  const commentInputId = `story-comment-${storyId}`;

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedComment = commentText.trim();

    if (!trimmedComment) {
      return;
    }

    onAddComment(trimmedComment);
    setCommentText("");
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
      {comments.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent comments
          </p>
          {comments.slice(-3).map((comment) => (
            <div key={comment.id} className="flex gap-3 text-sm">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: theme.accent,
                  color: theme.primary,
                }}
              >
                {comment.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {comment.authorName}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatStoryAge(comment.createdAt, currentTime)}
                  </span>
                </div>
                <p className="mt-1 leading-5 text-slate-600">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Be the first to comment.</p>
      )}

      <form onSubmit={submitComment} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor={commentInputId}>
          Add a comment
        </label>
        <input
          id={commentInputId}
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder="Add a comment..."
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-current"
          style={{ color: "#0f172a" }}
        />
        <button
          type="submit"
          disabled={!commentText.trim()}
          className="rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          style={{
            backgroundColor: theme.primary,
            color: theme.secondary,
          }}
        >
          Post
        </button>
      </form>
    </div>
  );
}
