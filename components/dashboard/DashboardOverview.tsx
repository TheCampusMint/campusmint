import type { UniversityTheme } from "@/data/universities";
import type { Story } from "@/types/story";

type DashboardOverviewProps = {
  theme: UniversityTheme;
  newestStory?: Story;
  joinedClubCount: number;
  onOpenStories: () => void;
  onOpenClubs: () => void;
  onOpenMarketplace: () => void;
};

export function DashboardOverview({
  theme,
  newestStory,
  joinedClubCount,
  onOpenStories,
  onOpenClubs,
  onOpenMarketplace,
}: DashboardOverviewProps) {
  const newestStoryPreview = newestStory
    ? `${newestStory.category}: ${newestStory.text.slice(0, 105)}${
        newestStory.text.length > 105 ? "…" : ""
      }`
    : "No stories are available for this campus and role yet.";

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <article className="rounded-2xl bg-white p-6 shadow-sm">
        <p
          className="text-sm font-medium"
          style={{ color: theme.primary }}
        >
          Campus Stories
        </p>

        <h3 className="mt-2 text-xl font-semibold">
          See what&apos;s happening now
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {newestStoryPreview}
        </p>

        <button
          type="button"
          onClick={onOpenStories}
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            backgroundColor: theme.primary,
            color: theme.secondary,
            outlineColor: theme.primary,
          }}
        >
          Open Stories
        </button>
      </article>

      <article className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium" style={{ color: theme.primary }}>
          My Clubs
        </p>

        <h3 className="mt-2 text-xl font-semibold">{joinedClubCount} joined</h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Discover organizations tied to your university and manage local memberships.
        </p>

        <button
          type="button"
          onClick={onOpenClubs}
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            backgroundColor: theme.primary,
            color: theme.secondary,
            outlineColor: theme.primary,
          }}
        >
          Discover Clubs
        </button>
      </article>

      <article className="rounded-2xl bg-white p-6 shadow-sm">
        <p
          className="text-sm font-medium"
          style={{ color: theme.primary }}
        >
          Upcoming Events
        </p>

        <h3 className="mt-2 text-xl font-semibold">Your campus calendar</h3>

        <p className="mt-2 text-sm text-slate-600">
          Sports, club events, career fairs, concerts, and volunteer
          opportunities.
        </p>
      </article>

      <article className="rounded-2xl bg-white p-6 shadow-sm">
        <p
          className="text-sm font-medium"
          style={{ color: theme.primary }}
        >
          Academic Hub
        </p>

        <h3 className="mt-2 text-xl font-semibold">Your classes</h3>

        <p className="mt-2 text-sm text-slate-600">
          Class pages, group chats, tutors, and study groups.
        </p>
      </article>

      <article className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium" style={{ color: theme.primary }}>
          Marketplace
        </p>

        <h3 className="mt-2 text-xl font-semibold">Student-to-student</h3>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Buy and sell with verified students.
        </p>

        <button
          type="button"
          onClick={onOpenMarketplace}
          className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            backgroundColor: theme.primary,
            color: theme.secondary,
            outlineColor: theme.primary,
          }}
        >
          Browse Marketplace
        </button>
      </article>
    </div>
  );
}
