import type { OrganizationMembershipStatus } from "@/types/organization";

type ClubMintBadgeProps = {
  membershipStatus?: OrganizationMembershipStatus;
  onMembershipAction?: () => void;
};

const clubBadgeStyles = {
  backgroundColor: "#ffedd5",
  borderColor: "#f97316",
  color: "#9a3412",
};

function badgeLabel(status: OrganizationMembershipStatus | undefined, actionable: boolean) {
  if (status === "member" || status === "officer" || status === "leader") return "YOUR CLUB";
  if (status === "requested") return "REQUEST PENDING";
  if (actionable && (status === "none" || status === "rejected" || !status)) return "JOIN CLUB";
  return "CLUB";
}

export function ClubMintBadge({ membershipStatus, onMembershipAction }: ClubMintBadgeProps) {
  const actionable = Boolean(onMembershipAction)
    && membershipStatus !== "requested"
    && membershipStatus !== "blocked"
    && membershipStatus !== "member"
    && membershipStatus !== "officer"
    && membershipStatus !== "leader";
  const className = "inline-flex rounded-full border-2 px-3 py-1 text-xs font-black uppercase tracking-wide";
  return actionable ? (
    <button type="button" onClick={onMembershipAction} className={className} style={clubBadgeStyles}>
      {badgeLabel(membershipStatus, true)}
    </button>
  ) : (
    <span className={className} style={clubBadgeStyles}>
      {badgeLabel(membershipStatus, false)}
    </span>
  );
}
