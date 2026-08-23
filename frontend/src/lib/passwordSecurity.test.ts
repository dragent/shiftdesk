import { describe, expect, it } from "vitest";
import {
  evaluatePasswordStrength,
  generateSecurePassword,
  PASSWORD_MIN_LENGTH,
} from "./passwordSecurity";

describe("evaluatePasswordStrength", () => {
  it("marks empty passwords", () => {
    const result = evaluatePasswordStrength("");
    expect(result.level).toBe("empty");
    expect(result.isAcceptable).toBe(false);
  });

  it("rejects short or incomplete passwords", () => {
    expect(evaluatePasswordStrength("abc").isAcceptable).toBe(false);
    expect(evaluatePasswordStrength("abcdefghijkl").isAcceptable).toBe(false);
    expect(evaluatePasswordStrength("Abcdefghijkl").isAcceptable).toBe(false);
    expect(evaluatePasswordStrength("Abcdefghijk1").isAcceptable).toBe(false);
  });

  it("accepts a policy-compliant password", () => {
    const result = evaluatePasswordStrength("MonMdpPerso1!");
    expect(result.isAcceptable).toBe(true);
    expect(["strong", "very-strong"]).toContain(result.level);
  });
});

describe("generateSecurePassword", () => {
  it("produces passwords that pass the strength policy", () => {
    for (let i = 0; i < 20; i++) {
      const password = generateSecurePassword();
      expect(password.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
      const strength = evaluatePasswordStrength(password);
      expect(strength.isAcceptable).toBe(true);
    }
  });
});
