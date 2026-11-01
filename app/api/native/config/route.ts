import { NextResponse } from "next/server";
import { nativeRealtimeConfig } from "@/lib/security/nativeRealtimeConfig";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { attestConfiguration } from "@/lib/security/attestPayload";

export async function GET() {
  const attest = attestConfiguration(process.env);
  const publicConfig = getSupabasePublicConfig();
  return NextResponse.json({
    apiVersion: 1,
    storageURL: publicConfig?.url ?? null,
    realtime: nativeRealtimeConfig(publicConfig),
    appleLinkingEnabled: false,
    appAttestEnabled: attest.enabled,
    appAttestRequired: attest.required,
  }, { headers: { "Cache-Control": "no-store" } });
}
