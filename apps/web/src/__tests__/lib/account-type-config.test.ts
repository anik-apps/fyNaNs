import { describe, it, expect } from "vitest";
import { ACCOUNT_TYPE_CONFIG } from "@/lib/account-type-config";

const EXPECTED_ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit",
  "investment",
  "loan",
] as const;

describe("ACCOUNT_TYPE_CONFIG", () => {
  it("has entries for all 5 account types", () => {
    for (const type of EXPECTED_ACCOUNT_TYPES) {
      expect(ACCOUNT_TYPE_CONFIG).toHaveProperty(type);
    }
  });

  it("has exactly 5 entries (no unexpected types)", () => {
    expect(Object.keys(ACCOUNT_TYPE_CONFIG)).toHaveLength(5);
  });

  it.each(EXPECTED_ACCOUNT_TYPES)(
    "%s entry has a non-empty label string",
    (type) => {
      const { label } = ACCOUNT_TYPE_CONFIG[type];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  );

  it.each(EXPECTED_ACCOUNT_TYPES)(
    "%s entry has an icon component",
    (type) => {
      const { icon } = ACCOUNT_TYPE_CONFIG[type];
      // lucide-react components may be functions or forwardRef objects depending on the environment
      expect(icon).toBeDefined();
      expect(icon).not.toBeNull();
    }
  );

  it.each(EXPECTED_ACCOUNT_TYPES)(
    "%s entry has a non-empty color string",
    (type) => {
      const { color } = ACCOUNT_TYPE_CONFIG[type];
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    }
  );

  it("has the correct labels for each account type", () => {
    expect(ACCOUNT_TYPE_CONFIG.checking.label).toBe("Checking");
    expect(ACCOUNT_TYPE_CONFIG.savings.label).toBe("Savings");
    expect(ACCOUNT_TYPE_CONFIG.credit.label).toBe("Credit Card");
    expect(ACCOUNT_TYPE_CONFIG.investment.label).toBe("Investment");
    expect(ACCOUNT_TYPE_CONFIG.loan.label).toBe("Loan");
  });
});
