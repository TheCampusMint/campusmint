import { NextResponse } from "next/server";

import { getStudentVerificationService } from "@/lib/auth/studentVerificationServer";

export const runtime = "nodejs";

function verificationInputFromBody(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    !("challengeId" in body) ||
    !("code" in body) ||
    typeof body.challengeId !== "string" ||
    typeof body.code !== "string"
  ) {
    return null;
  }

  return {
    challengeId: body.challengeId,
    code: body.code,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const input = verificationInputFromBody(body);

  if (!input) {
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_request",
        message:
          "Enter the six-digit verification code.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const result =
    await getStudentVerificationService().verifyCode(
      input,
    );

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
