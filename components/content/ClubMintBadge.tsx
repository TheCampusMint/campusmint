import type { OrganizationMembershipStatus } from "@/types/organization";

type ClubMintBadgeProps = {
  membershipStatus?: OrganizationMembershipStatus;
  onMembershipAction?: () => void;
};

const clubBadgeStyles = {
  backgroundColor: "#ffedd5",
  borderColor: "#f97316",
  color: "#9a3412",
  boxShadow: "0 7px 20px rgba(249, 115, 22, 0.2)",
};

export function ClubMintBadge({ membershipStatus, onMembershipAction }: ClubMintBadgeProps) {
  const accepted = membershipStatus === "member" || membershipStatus === "officer" || membershipStatus === "leader";
  const actionable = Boolean(onMembershipAction)
    && membershipStatus !== "requested"
    && membershipStatus !== "blocked"
    && membershipStatus !== "member"
    && membershipStatus !== "officer"
    && membershipStatus !== "leader";
  const className = "interactive-pop inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em]";
  if (accepted) return <span className={className} style={clubBadgeStyles}>YOUR CLUB</span>;
  return (
    <span className="inline-flex flex-wrap gap-2">
      <span className={className} style={clubBadgeStyles}>CLUB</span>
      {membershipStatus === "requested" && <span className={className} style={clubBadgeStyles}>REQUEST PENDING</span>}
      {actionable && <button type="button" onClick={onMembershipAction} className={className} style={clubBadgeStyles}>JOIN CLUB</button>}
    </span>
  );
}
