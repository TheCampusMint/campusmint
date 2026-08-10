import type { UniversityTheme } from "@/data/universities";

type ClubChatPlaceholderProps = {
  theme: UniversityTheme;
  isMember: boolean;
};

export function ClubChatPlaceholder({ theme, isMember }: ClubChatPlaceholderProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>#</div>
        <div>
          <h3 className="font-bold text-slate-900">Club Chat</h3>
          <p className="mt-0.5 text-sm text-slate-600">Club chat will become available to members.</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {isMember ? "Your membership is active locally; real-time chat is not connected yet." : "Join the club to be ready when member chat is connected."}
      </p>
    </section>
  );
}
