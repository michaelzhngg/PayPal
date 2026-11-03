import { describe, it, expect } from "vitest";
import { isProfileChanged, normalizeProfile, profileError, profileFailedToast } from "./profileForm";

describe("profile form", () => {
  it("trims the name and the email", () => {
    expect(normalizeProfile({ name: "  Aisyah   Rahman ", email: " Aisyah@Example.COM " })).toEqual({
      name: "Aisyah Rahman",
      email: "Aisyah@Example.COM",
    });
  });
  it("needs a name and a valid email", () => {
    expect(profileError({ name: " ", email: "a@b.co" })).toBe("Enter your full name.");
    expect(profileError({ name: "A", email: "not-an-email" })).toBe("Enter an email address like name@company.com.");
    expect(profileError({ name: "A", email: "a@b.co" })).toBeNull();
  });
  it("ignores surrounding whitespace when checking for changes", () => {
    const saved = { name: "Aisyah Rahman", email: "aisyah@example.com" };
    expect(isProfileChanged({ name: "Aisyah Rahman ", email: " aisyah@example.com" }, saved)).toBe(false);
    expect(isProfileChanged({ name: "Aisyah R.", email: saved.email }, saved)).toBe(true);
  });
  it("shows the backend reason when the save fails", () => {
    expect(profileFailedToast("Email is already in use by another account.").description).toBe(
      "Email is already in use by another account. Nothing was changed.",
    );
    expect(profileFailedToast(null).description).toBe("Nothing was changed. Try again in a moment.");
  });
});
