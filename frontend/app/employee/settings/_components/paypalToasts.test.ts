import { describe, it, expect } from "vitest";
import { callbackToast, connectFailedToast } from "./paypalToasts";

describe("callbackToast", () => {
  it("confirms a linked account", () => {
    expect(callbackToast("linked")).toEqual({
      tone: "success",
      title: "PayPal account linked",
      description: "Instant payouts are on.",
    });
  });

  it("reports a failed link as an error", () => {
    expect(callbackToast("error")?.tone).toBe("error");
  });

  it("ignores a missing or unknown outcome", () => {
    expect(callbackToast(null)).toBeNull();
    expect(callbackToast("something-else")).toBeNull();
  });
});

describe("connectFailedToast", () => {
  it("includes the backend error when there is one", () => {
    expect(connectFailedToast("503: Service Unavailable").description).toBe(
      "503: Service Unavailable. Try again in a moment.",
    );
    expect(connectFailedToast(null).description).toBe("Try again in a moment.");
  });
});
