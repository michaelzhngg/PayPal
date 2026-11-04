import { cookies } from "next/headers";
import { apiPost, API_PREFIX } from "@/lib/api/client";
import { redirectTo, SIGNIN_COOKIE, signinCookieOptions, SIGNIN_FAILED_PATH } from "../signinCookie";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");

  const cookieStore = await cookies();
  const binding = cookieStore.get(SIGNIN_COOKIE)?.value;
  // Cleared on every outcome, so this callback URL can't be replayed in this browser.
  cookieStore.set(SIGNIN_COOKIE, "", { ...signinCookieOptions, maxAge: 0 });
  if (!code || !state || !binding) return redirectTo(SIGNIN_FAILED_PATH);

  const result = await apiPost<{ access_token: string; expires_in: number }>(
    `${API_PREFIX}/paypal/signin/complete`,
    { code, state, binding },
  );
  if (!result.data) return redirectTo(SIGNIN_FAILED_PATH);

  cookieStore.set("session", result.data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: result.data.expires_in,
    sameSite: "lax",
  });
  return redirectTo("/employee/dashboard");
}
