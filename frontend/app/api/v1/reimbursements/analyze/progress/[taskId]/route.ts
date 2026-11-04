import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  // EventSource can't set headers, so the HttpOnly session cookie becomes the backend's bearer token here.
  // API clients such as demo/scripts/flood.py reach this route with their own bearer token.
  const token = req.cookies.get("session")?.value;
  const authorization = token ? `Bearer ${token}` : req.headers.get("authorization");
  if (!authorization) {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const backendUrl =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";

  const response = await fetch(
    `${backendUrl}/api/v1/reimbursements/analyze/progress/${taskId}`,
    { headers: { Accept: "text/event-stream", Authorization: authorization } }
  );

  if (!response.ok || !response.body) {
    const refused = response.status === 401 || response.status === 403;
    return new Response(
      JSON.stringify({ error: refused ? "Not allowed to read this stream" : "Upstream SSE endpoint unavailable" }),
      { status: refused ? response.status : 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
