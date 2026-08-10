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
          <p className="mt-0.5 text-sm text-slate-600">Official member group conversation</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {canAccess && participantAdded
          ? "Access is active locally and you are an official conversation participant. Real-time messages are not connected yet."
          : "Only accepted members, officers, and leaders can enter or read this group conversation."}
      </p>
      <button type="button" disabled={!canAccess || !participantAdded} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" style={canAccess && participantAdded ? { backgroundColor: theme.primary, color: theme.secondary } : undefined}>{canAccess && participantAdded ? "Open Club Chat (local placeholder)" : "Club Chat Locked"}</button>
    </section>
  );
}
