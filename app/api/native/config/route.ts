import { NextResponse } from "next/server";
import { attestConfiguration } from "@/lib/security/attestPayload";
export async function GET() {
  const attest = attestConfiguration(process.env);
  return NextResponse.json({ apiVersion: 1, appleLinkingEnabled: false, appAttestEnabled: attest.enabled, appAttestRequired: attest.required }, { headers: { "Cache-Control": "no-store" } });
}
