import { expect, it } from "vitest";
import { normalizeLinkedIn } from "./signup";
it("WEB-15 accepts profile-link variants and rejects external, company and malformed links", () => {
  for (const url of [
    "linkedin.com/in/danny",
    "www.linkedin.com/in/danny/",
    "https://uk.linkedin.com/in/danny/?trk=share#profile",
  ]) {
    expect(normalizeLinkedIn(url)).toBe("https://www.linkedin.com/in/danny/");
  }
  for (const url of [
    "linkedin.com/company/x",
    "https://linkedin.com.evil.test/in/danny",
    "https://evil.test/in/danny",
    "javascript:alert(1)",
    "https://user:pass@linkedin.com/in/danny",
    "https://linkedin.com/in/danny/extra",
    "https://linkedin.com/in/%2Fbad",
    "",
  ]) {
    expect(normalizeLinkedIn(url)).toBeNull();
  }
});
