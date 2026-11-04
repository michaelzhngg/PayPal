import { cookies } from "next/headers";
import { apiGet, API_PREFIX } from "@/lib/api/client";
import { redirectTo, SIGNIN_COOKIE, signinCookieOptions, SIGNIN_FAILED_PATH } from "../signinCookie";

const STATE_TTL_SECONDS = 600;

export async function GET(): Promise<Response> {
  const result = await apiGet<{ url: string; binding: string }>(`${API_PREFIX}/paypal/signin/start`);
  if (!result.data) return redirectTo(SIGNIN_FAILED_PATH);

  const cookieStore = await cookies();
  cookieStore.set(SIGNIN_COOKIE, result.data.binding, { ...signinCookieOptions, maxAge: STATE_TTL_SECONDS });
  return redirectTo(result.data.url);
}
