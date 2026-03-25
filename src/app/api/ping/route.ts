export async function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() }, { status: 200 });
}
