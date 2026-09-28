export function canShareMint(input: {status:unknown; privacy:unknown; accountType:unknown; archivedAt:unknown; expiresAt:unknown; organizationAudience:unknown}, now=Date.now()) {
  return input.status === "active" && input.privacy === "public" && input.accountType === "public" && !input.archivedAt && input.organizationAudience !== "members" && (input.expiresAt == null || (typeof input.expiresAt === "string" && Date.parse(input.expiresAt) > now));
}
