import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string) => jar.set(name, value));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { GET } = await import("./route");

const CALLBACK = "http://localhost:3000/login/paypal/callback?code=c&state=s";

function backendReplies(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("PayPal sign-in callback", () => {
  beforeEach(() => {
    jar.clear();
    set.mockClear();
    fetchMock.mockReset();
  });

  it("sets the session as an HttpOnly cookie and keeps the token out of the URL", async () => {
    jar.set("paypal_signin", "b");
    backendReplies(200, { access_token: "SECRET-TOKEN", expires_in: 259200 });

    const res = await GET(new Request(CALLBACK));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/employee/dashboard");
    expect(set).toHaveBeenCalledWith("session", "SECRET-TOKEN", expect.objectContaining({
      httpOnly: true, path: "/", sameSite: "lax", maxAge: 259200,
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ code: "c", state: "s", binding: "b" });
  });

  it("refuses a callback from a browser that didn't start the sign-in", async () => {
    const res = await GET(new Request(CALLBACK));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get("Location")).toBe("/login?paypal=failed");
    expect(jar.has("session")).toBe(false);
  });

  it("shows the same failure when the backend rejects the sign-in", async () => {
    jar.set("paypal_signin", "b");
    backendReplies(401, { detail: "PayPal sign-in failed" });

    const res = await GET(new Request(CALLBACK));

    expect(res.headers.get("Location")).toBe("/login?paypal=failed");
    expect(jar.has("session")).toBe(false);
  });

  it("clears the browser binding so the URL can't be replayed", async () => {
    jar.set("paypal_signin", "b");
    backendReplies(401, {});

    await GET(new Request(CALLBACK));

    expect(jar.get("paypal_signin")).toBe("");
    expect(set).toHaveBeenCalledWith("paypal_signin", "", expect.objectContaining({ maxAge: 0, path: "/login/paypal" }));
  });

  it("fails when PayPal returns without a code", async () => {
    jar.set("paypal_signin", "b");

    const res = await GET(new Request("http://localhost:3000/login/paypal/callback?error=access_denied"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get("Location")).toBe("/login?paypal=failed");
  });
});
