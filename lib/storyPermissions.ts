import type { UserRole } from "@/data/userRoles";
import {
  storyAudienceOptions,
  type Story,
  type StoryAudience,
} from "@/types/story";

const visibleAudiencesByRole: Record<UserRole, StoryAudience[]> = {
  student: ["students-only", "students-alumni", "everyone"],
  alumni: ["students-alumni", "everyone"],
  supporter: ["everyone"],
  "university-admin": ["everyone"],
  "local-business": ["everyone"],
};

export function canRoleViewAudience(
  role: UserRole,
  audience: StoryAudience,
) {
  return visibleAudiencesByRole[role].includes(audience);
}

export function getVisibleAudienceOptions(role: UserRole) {
  return storyAudienceOptions.filter((option) =>
    canRoleViewAudience(role, option.id),
  );
}

export function getAudienceLabel(audience: StoryAudience) {
  return (
    storyAudienceOptions.find((option) => option.id === audience)?.label ??
    audience
  );
}

export function isStoryActive(story: Story, currentTime: number) {
  return new Date(story.expiresAt).getTime() > currentTime;
}

export function getVisibleStories(
  stories: Story[],
  accessibleCampuses: string[],
  role: UserRole,
  currentTime: number,
) {
  return stories
    .filter(
      (story) =>
        accessibleCampuses.includes(story.campus) &&
        canRoleViewAudience(role, story.audience) &&
        isStoryActive(story, currentTime),
    )
    .sort(
      (firstStory, secondStory) =>
        new Date(secondStory.createdAt).getTime() -
        new Date(firstStory.createdAt).getTime(),
    );
}

export function formatStoryAge(createdAt: string, currentTime: number) {
  const elapsedMilliseconds = Math.max(
    0,
    currentTime - new Date(createdAt).getTime(),
  );
  const elapsedMinutes = Math.floor(elapsedMilliseconds / (60 * 1000));

  if (elapsedMinutes < 1) {
    return "now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h`;
  }

  return `${Math.floor(elapsedHours / 24)}d`;
}
