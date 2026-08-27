import { NextResponse } from "next/server";

import { getStudentVerificationService } from "@/lib/auth/studentVerificationServer";

export const runtime = "nodejs";

function emailFromBody(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    typeof body.email !== "string"
  ) {
    return null;
  }

  return body.email;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const email = emailFromBody(body);

  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_request",
        message: "Enter a valid student email.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const result =
    await getStudentVerificationService().requestCode(
      email,
    );

  const status = result.ok
    ? 200
    : result.reason === "resend_cooldown"
      ? 429
      : result.reason === "delivery_unavailable"
        ? 503
        : 400;

  return NextResponse.json(result, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
