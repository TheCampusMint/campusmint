import "server-only";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
export class MarketplaceError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function marketplaceSession() {
  if (!hasSupabaseServerConfig()) throw new MarketplaceError("Sell is temporarily unavailable.", 503);
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new MarketplaceError("Sign in to use Sell.", 401);
  const admin = createSupabaseAdminClient();
  const identity = await admin.from("profile_identities").select("university_id,account_type,verified_student").eq("user_id", user.id).maybeSingle();
  if (identity.error) throw identity.error;
  if (identity.data?.account_type !== "student" || !identity.data.verified_student || !identity.data.university_id) throw new MarketplaceError("Sell is available to verified students.", 403);
  const campus = identity.data.university_id;
  const [network, verification, policy] = await Promise.all([
    admin.from("campus_network_universities").select("campus_network_id").eq("university_id", campus).maybeSingle(),
    admin.from("marketplace_verified_students").select("revoked_at").eq("user_id", user.id).eq("university_id", campus).maybeSingle(),
    admin.from("university_marketplace_policies").select("marketplace_enabled,prohibited_categories").eq("university_id", campus).maybeSingle(),
  ]);
  if (network.error || verification.error || policy.error) throw network.error ?? verification.error ?? policy.error;
  if (verification.data?.revoked_at || policy.data?.marketplace_enabled === false) throw new MarketplaceError("Sell is not available for this account or campus.", 403);
  if (!network.data) throw new MarketplaceError("Sell is not available at this campus yet.", 403);
  const features = await admin.from("campus_networks").select("enabled_features").eq("id", network.data.campus_network_id).maybeSingle();
  if (features.error) throw features.error;
  if (!features.data?.enabled_features?.includes("marketplace")) throw new MarketplaceError("Sell is not available at this campus yet.", 403);
  return { admin, user, campus, networkId: network.data.campus_network_id as string, policy: policy.data };
}
export async function blockedUsers(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const result = await admin.from("profile_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (result.error) throw result.error;
  return new Set((result.data ?? []).map((row) => row.blocker_id === userId ? row.blocked_id : row.blocker_id));
}
