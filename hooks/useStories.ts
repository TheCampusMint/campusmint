"use client";

import { useEffect, useMemo, useState } from "react";

import { createSampleStories } from "@/data/stories";
import { resolveContentStatus } from "@/lib/content/expiration";
import type { Story, StoryComment } from "@/types/story";

export function useStories() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [storedStories, setStoredStories] = useState<Story[]>(() =>
    createSampleStories(currentTime),
  );
  const stories = useMemo(() => storedStories.map((story) => ({
    ...story,
    status: resolveContentStatus(story.status ?? "active", story.expiresAt, currentTime),
  })), [currentTime, storedStories]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);

    return () => window.clearInterval(timer);
  }, []);

  function toggleLike(storyId: Story["id"]) {
    setStoredStories((currentStories) =>
      currentStories.map((story) => {
        if (story.id !== storyId) {
          return story;
        }

        const nextLikedState = !story.likedByCurrentUser;

        return {
          ...story,
          likedByCurrentUser: nextLikedState,
          likeCount: Math.max(
            0,
            story.likeCount + (nextLikedState ? 1 : -1),
          ),
        };
      }),
    );
  }

  function addComment(storyId: Story["id"], comment: StoryComment) {
    setStoredStories((currentStories) =>
      currentStories.map((story) =>
        story.id === storyId && story.commentsEnabled !== false
          ? {
              ...story,
              commentCount: story.commentCount + 1,
              comments: [...story.comments, comment],
            }
          : story,
      ),
    );
  }

  function addStory(story: Story) {
    setStoredStories((currentStories) => [story, ...currentStories]);
    setCurrentTime(Date.now());
  }

  return {
    stories,
    currentTime,
    toggleLike,
    addComment,
    addStory,
  };
}
