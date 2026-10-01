/** Raw provider resource names are no longer accepted. Use a registered Place ID. */
export async function GET() {
  return Response.json({ message: "Use the place photo endpoint." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
