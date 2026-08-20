import { describe, expect, it, beforeEach } from "vitest";
import { hasAiConsent, grantAiConsent } from "./aiConsent";

describe("aiConsent", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns false before consent is granted", () => {
    expect(hasAiConsent()).toBe(false);
  });

  it("returns true after consent is granted", () => {
    grantAiConsent();
    expect(hasAiConsent()).toBe(true);
  });
});
