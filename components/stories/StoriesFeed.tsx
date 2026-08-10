"use client";

import { useState } from "react";

import { CreateStoryModal } from "@/components/stories/CreateStoryModal";
import { StoryCard } from "@/components/stories/StoryCard";
import { StoryFilters } from "@/components/stories/StoryFilters";
import type { UniversityTheme } from "@/data/universities";
import { getVisibleStories } from "@/lib/storyPermissions";
import type {
  Story,
  StoryComment,
  StoryFilter,
} from "@/types/story";
import type { TemporaryUser } from "@/types/user";

type StoriesFeedProps = {
  stories: Story[];
  currentUser: TemporaryUser;
  accessibleCampuses: string[];
  currentTime: number;
  theme: UniversityTheme;
  onToggleLike: (storyId: Story["id"]) => void;
  onAddComment: (storyId: Story["id"], comment: StoryComment) => void;
  onCreateStory: (story: Story) => void;
  onOpenProfile?: (userId: string) => void;
};

const categoryFilters: Partial<Record<StoryFilter, Story["category"][]>> = {
  Social: ["Social", "Campus Life", "Music"],
  Clubs: ["Club"],
  Sports: ["Sports", "Tailgate"],
  Study: ["Study"],
  "Free Food": ["Free Food"],
};

export function StoriesFeed({
  stories,
  currentUser,
  accessibleCampuses,
  currentTime,
  theme,
  onToggleLike,
  onAddComment,
  onCreateStory,
  onOpenProfile,
}: StoriesFeedProps) {
  const [activeFilter, setActiveFilter] = useState<StoryFilter>("For You");
  const [createStoryOpen, setCreateStoryOpen] = useState(false);

  const eligibleStories = getVisibleStories(
    stories,
    accessibleCampuses,
    currentUser.role,
    currentTime,
  );
  const visibleStories = eligibleStories.filter((story) => {
    if (activeFilter === "For You") {
      return true;
    }

    if (activeFilter === "My Campus") {
      return story.campus === currentUser.universityId;
    }

    return categoryFilters[activeFilter]?.includes(story.category) ?? false;
  });

  function addLocalComment(storyId: Story["id"], text: string) {
    onAddComment(storyId, {
      id: `local-comment-${globalThis.crypto.randomUUID()}`,
      authorName: currentUser.firstName,
      text,
      createdAt: new Date().toISOString(),
    });
  }

  function createLocalStory(story: Story) {
    onCreateStory(story);
    setActiveFilter("For You");
    setCreateStoryOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: theme.primary }}
            >
              Live campus activity
            </p>
            <h2 className="mt-1 text-3xl font-bold text-slate-950">
              Campus Stories
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Student posts, campus updates, and what is happening right now.
              Stories disappear 24 hours after posting.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateStoryOpen(true)}
            className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: theme.primary,
              color: theme.secondary,
              outlineColor: theme.primary,
            }}
          >
            Create Story
          </button>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <StoryFilters
            activeFilter={activeFilter}
            theme={theme}
            onFilterChange={setActiveFilter}
          />
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4 px-1 text-sm text-slate-500">
          <p>Updates expire after 24 hours.</p>
          <p>Newest first</p>
        </div>

        {visibleStories.length > 0 ? (
          visibleStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              currentTime={currentTime}
              theme={theme}
              onToggleLike={onToggleLike}
              onAddComment={addLocalComment}
              onOpenProfile={onOpenProfile}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              No stories in this view
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Try another filter, campus, or role—or create the first story.
            </p>
          </div>
        )}
      </div>

      {createStoryOpen && (
        <CreateStoryModal
          key={`${currentUser.universityId}-${currentUser.role}`}
          currentUser={currentUser}
          theme={theme}
          onClose={() => setCreateStoryOpen(false)}
          onCreate={createLocalStory}
        />
      )}
    </div>
  );
}
