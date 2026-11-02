import { test, expect } from "@playwright/test";
import { normaliseUpiId, upiPayLink } from "../lib/upi/link";

/** THE UPI LINK, AS A PURE FUNCTION (2 Nov 2026). No page: Playwright runs the
 *  TypeScript, and the three checks pin the shape rule and the five query
 *  fields the Pay sheet depends on. */

test("normaliseUpiId trims, lower-cases and refuses bad shapes", () => {
  expect(normaliseUpiId(" Priya.S@OKHDFC ")).toBe("priya.s@okhdfc");
  expect(normaliseUpiId("priya@")).toBeNull();
  expect(normaliseUpiId("@okhdfc")).toBeNull();
  expect(normaliseUpiId("priya okhdfc")).toBeNull();
  expect(normaliseUpiId("")).toBeNull();
});

test("upiPayLink carries the five fields and an ASCII-safe payee name", () => {
  const link = upiPayLink({ upiId: "priya@okhdfc", payeeName: "Priya & Co's क्रू", amountInr: 1000, payoutId: "8f1c2a3b-4d5e-6f70-8192-a3b4c5d6e7f8" });
  const u = new URL(link);
  expect(u.protocol).toBe("upi:");
  expect(u.searchParams.get("pa")).toBe("priya@okhdfc");
  expect(u.searchParams.get("pn")).toBe("Priya  Cos");
  expect(u.searchParams.get("am")).toBe("1000.00");
  expect(u.searchParams.get("cu")).toBe("INR");
  expect(u.searchParams.get("tn")).toBe("DanceOS team pay");
  expect(u.searchParams.get("tr")).toBe("8f1c2a3b4d5e6f708192a3b4c5d6e7f8");
});

test("upiPayLink percent-encodes spaces — iOS UPI apps do not read + as a space", () => {
  const link = upiPayLink({ upiId: "priya@okhdfc", payeeName: "Priya & Co's क्रू", amountInr: 1000, payoutId: "8f1c2a3b-4d5e-6f70-8192-a3b4c5d6e7f8" });
  expect(link).not.toContain("+");
  expect(link).toContain("pn=Priya%20%20Cos");
  expect(link).toContain("tn=DanceOS%20team%20pay");
});

test("upiPayLink never sends an empty payee name — a name with no Latin letters falls back", () => {
  const link = upiPayLink({ upiId: "a@b", payeeName: "क्रू", amountInr: 1, payoutId: "00000000-0000-0000-0000-000000000000" });
  expect(new URL(link).searchParams.get("pn")).toBe("DanceOS team member");
});

test("upiPayLink caps the payee name at 50 characters", () => {
  const link = upiPayLink({ upiId: "a@b", payeeName: "x".repeat(80), amountInr: 1, payoutId: "00000000-0000-0000-0000-000000000000" });
  expect(new URL(link).searchParams.get("pn")).toHaveLength(50);
});
