import type { UniversityTheme } from "@/data/universities";

type DashboardOverviewProps = {
  theme: UniversityTheme;
};

const dashboardCards = [
  {
    eyebrow: "Campus Stories",
    title: "See what's happening now",
    description: "Parties, study groups, free food, clubs, tailgates, and more.",
  },
  {
    eyebrow: "Upcoming Events",
    title: "Your campus calendar",
    description:
      "Sports, club events, career fairs, concerts, and volunteer opportunities.",
  },
  {
    eyebrow: "Academic Hub",
    title: "Your classes",
    description: "Class pages, group chats, tutors, and study groups.",
  },
];

export function DashboardOverview({ theme }: DashboardOverviewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {dashboardCards.map((card) => (
        <article key={card.eyebrow} className="rounded-2xl bg-white p-6 shadow-sm">
          <p
            className="text-sm font-medium"
            style={{ color: theme.primary }}
          >
            {card.eyebrow}
          </p>

          <h3 className="mt-2 text-xl font-semibold">{card.title}</h3>

          <p className="mt-2 text-sm text-slate-600">{card.description}</p>
        </article>
      ))}
    </div>
  );
}
