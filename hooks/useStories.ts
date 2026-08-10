"use client";

import { useEffect, useState } from "react";

import { createSampleStories } from "@/data/stories";
import type { Story, StoryComment } from "@/types/story";

export function useStories() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [stories, setStories] = useState<Story[]>(() =>
    createSampleStories(currentTime),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);

    return () => window.clearInterval(timer);
  }, []);

  function toggleLike(storyId: Story["id"]) {
    setStories((currentStories) =>
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
    setStories((currentStories) =>
      currentStories.map((story) =>
        story.id === storyId
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
    setStories((currentStories) => [story, ...currentStories]);
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
