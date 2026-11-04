import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const params = Promise.resolve({ taskId: "abc" });

function request(cookie?: string, authorization?: string) {
  return new NextRequest("http://localhost/api/v1/reimbursements/analyze/progress/abc", {
    headers: { ...(cookie ? { cookie } : {}), ...(authorization ? { authorization } : {}) },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("analyze progress proxy", () => {
  it("sends the session cookie to the backend as a bearer token", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response("event: complete\n\n", { status: 200 }));
    vi.stubGlobal("fetch", upstream);

    const res = await GET(request("session=tok123"), { params });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe("Bearer tok123");
  });

  it("passes on an API client's bearer token", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response("event: complete\n\n", { status: 200 }));
    vi.stubGlobal("fetch", upstream);

    await GET(request(undefined, "Bearer api-token"), { params });

    expect(upstream.mock.calls[0][1].headers.Authorization).toBe("Bearer api-token");
  });

  it("answers 401 without calling the backend when there is no session", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const res = await GET(request(), { params });

    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("passes on the backend's refusal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));

    const res = await GET(request("session=someone-else"), { params });

    expect(res.status).toBe(403);
  });
});
