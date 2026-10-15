/**
 * Same-origin JSON-RPC proxy to the GenLayer studionet endpoint.
 *
 * Browsers block direct calls to https://studio.genlayer.com/api (no CORS
 * headers), so every frontend read/write goes through here instead.
 * Server-to-server has no CORS restriction.
 */

const UPSTREAM = "https://studio.genlayer.com/api";

export async function POST(req: Request) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return Response.json({ error: "unreadable request body" }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e) {
    return Response.json(
      { error: `Upstream GenLayer RPC unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
