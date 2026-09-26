type CreatorBadgeProps = {
  approved: boolean;
  className?: string;
};

export function CreatorBadge({ approved, className = "" }: CreatorBadgeProps) {
  if (!approved) return null;
  return (
    <span
      aria-label="Approved Campus Mint Creator"
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${className}`}
      style={{
        color: "var(--creator-badge-text, var(--app-accent))",
        borderColor: "var(--creator-badge-border, color-mix(in srgb, var(--app-accent) 52%, transparent))",
        backgroundColor: "var(--creator-badge-background, color-mix(in srgb, var(--app-accent) 10%, var(--app-surface)))",
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3.2 8.2 2.8 2.7 6.7-6.2" />
      </svg>
      Creator
    </span>
  );
}
