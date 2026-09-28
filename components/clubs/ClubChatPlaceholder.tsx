import type { UniversityTheme } from "@/data/universities";

type ClubChatPlaceholderProps = {
  theme: UniversityTheme;
  canAccess: boolean;
  participantAdded: boolean;
};

export function ClubChatPlaceholder({ theme, canAccess, participantAdded }: ClubChatPlaceholderProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>#</div>
        <div>
          <h3 className="font-bold text-slate-900">Club Chat</h3>
        </div>
      </div>
      <button type="button" disabled className="mt-3 w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500" style={{ borderColor: theme.primary }}>
        {!canAccess || !participantAdded ? "Club Chat Locked" : "Club Chat Coming Soon"}
      </button>
    </section>
  );
}
