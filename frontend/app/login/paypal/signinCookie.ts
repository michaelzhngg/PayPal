/** Ties a PayPal sign-in to the browser that started it, so a crafted callback link can't sign someone else in. */
export const SIGNIN_COOKIE = "paypal_signin";
export const SIGNIN_FAILED_PATH = "/login?paypal=failed";

export const signinCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/login/paypal",
  // Lax, not Strict: the browser must send it on the top-level redirect back from PayPal.
  sameSite: "lax",
} as const;

/** A relative Location keeps the browser on the public origin when Next.js sits behind Caddy. */
export function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}
