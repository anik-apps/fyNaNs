import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  getDateGroupLabel,
} from "@/src/lib/utils";

describe("formatCurrency", () => {
  it("formats a numeric string amount with commas and dollar sign", () => {
    expect(formatCurrency("1234.56")).toBe("$1,234.56");
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats a plain number", () => {
    expect(formatCurrency(9.99)).toBe("$9.99");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});

describe("formatDate", () => {
  it("formats a Date object in short month-day-year form", () => {
    // Use a local Date constructor to avoid UTC timezone drift
    const d = new Date(2026, 2, 15); // Mar 15, 2026 local time
    expect(formatDate(d)).toBe("Mar 15, 2026");
  });

  it("formats another Date object correctly", () => {
    const d = new Date(2026, 0, 1); // Jan 1, 2026 local time
    expect(formatDate(d)).toBe("Jan 1, 2026");
  });

  it("formats an ISO date string (timezone-aware: result is local interpretation)", () => {
    // ISO strings are parsed as UTC midnight; the local date may differ.
    // Verify the result is a valid formatted date string rather than asserting a specific day.
    const result = formatDate("2026-03-15");
    expect(result).toMatch(/^(Mar 14|Mar 15), 2026$/);
  });
});

describe("formatRelativeDate", () => {
  it("returns 'Today' for a date that is the same calendar day", () => {
    const now = new Date();
    // Build noon today in local time to avoid day-boundary edge cases
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    expect(formatRelativeDate(today)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
    expect(formatRelativeDate(yesterday)).toBe("Yesterday");
  });

  it("returns 'Xd ago' for dates 2–6 days ago", () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 12, 0, 0);
    expect(formatRelativeDate(threeDaysAgo)).toBe("3d ago");
  });

  it("returns a formatted date string for dates 7+ days ago", () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 12, 0, 0);
    const result = formatRelativeDate(tenDaysAgo);
    expect(result).not.toMatch(/^(\d+d ago|Today|Yesterday)$/);
  });
});

describe("getDateGroupLabel", () => {
  // Build ISO-like strings using local date parts to avoid UTC-midnight timezone drift
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;

  it("returns 'Today' for today's date", () => {
    const now = new Date();
    const todayStr = toLocalDateString(now);
    expect(getDateGroupLabel(todayStr)).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    expect(getDateGroupLabel(toLocalDateString(yesterday))).toBe("Yesterday");
  });

  it("returns a formatted date string for older dates", () => {
    // Use a local Date to produce a date string that avoids UTC-midnight drift
    const d = new Date(2026, 2, 15, 12, 0, 0); // Mar 15, 2026 at noon local
    expect(getDateGroupLabel(d.toISOString())).toBe("Mar 15, 2026");
  });

  it("returns a formatted date string for any date older than yesterday", () => {
    const d = new Date(2026, 3, 1, 12, 0, 0); // Apr 1, 2026 at noon local
    expect(getDateGroupLabel(d.toISOString())).toBe("Apr 1, 2026");
  });
});
