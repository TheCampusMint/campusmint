import type { UniversityTheme } from "@/data/universities";

type ClubChatPlaceholderProps = {
  theme: UniversityTheme;
  canAccess: boolean;
  participantAdded: boolean;
};

export function ClubChatPlaceholder({ theme, canAccess, participantAdded }: ClubChatPlaceholderProps) {
  const unavailableReason = !canAccess
    ? "Join this organization before accessing its club chat."
    : !participantAdded
      ? "Your chat access is still being prepared."
      : "Club chat is not available in this preview yet.";

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>#</div>
        <div>
          <h3 className="font-bold text-slate-900">Club Chat</h3>
          <p className="mt-0.5 text-sm text-slate-600">Official member group conversation</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {canAccess && participantAdded
          ? "Access is active locally and you are an official conversation participant. Real-time messages are not connected yet."
          : "Only accepted members, officers, and leaders can enter or read this group conversation."}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-500">{unavailableReason}</p>
      <button type="button" disabled className="mt-3 w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500" style={{ borderColor: theme.primary }}>
        {!canAccess || !participantAdded ? "Club Chat Locked" : "Club Chat Coming Soon"}
      </button>
    </section>
  );
}
