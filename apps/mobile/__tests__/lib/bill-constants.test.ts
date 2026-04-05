import {
  BILL_STATUS_LABELS,
  BILL_STATUS_COLORS,
} from "@/src/lib/bill-constants";

const EXPECTED_STATUSES = ["overdue", "due_soon", "auto_pay", "upcoming"];

describe("BILL_STATUS_LABELS", () => {
  it("has an entry for every expected status", () => {
    for (const status of EXPECTED_STATUSES) {
      expect(BILL_STATUS_LABELS).toHaveProperty(status);
    }
  });

  it("contains human-readable non-empty label strings", () => {
    for (const status of EXPECTED_STATUSES) {
      const label = BILL_STATUS_LABELS[status];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("maps each status to the correct label", () => {
    expect(BILL_STATUS_LABELS.overdue).toBe("Overdue");
    expect(BILL_STATUS_LABELS.due_soon).toBe("Due Soon");
    expect(BILL_STATUS_LABELS.auto_pay).toBe("Auto Pay");
    expect(BILL_STATUS_LABELS.upcoming).toBe("Upcoming");
  });
});

describe("BILL_STATUS_COLORS", () => {
  it("has an entry for every expected status", () => {
    for (const status of EXPECTED_STATUSES) {
      expect(BILL_STATUS_COLORS).toHaveProperty(status);
    }
  });

  it("all color values are valid hex strings", () => {
    const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const status of EXPECTED_STATUSES) {
      const color = BILL_STATUS_COLORS[status];
      expect(color).toMatch(hexColorPattern);
    }
  });

  it("BILL_STATUS_COLORS and BILL_STATUS_LABELS have matching keys", () => {
    const labelKeys = Object.keys(BILL_STATUS_LABELS).sort();
    const colorKeys = Object.keys(BILL_STATUS_COLORS).sort();
    expect(colorKeys).toEqual(labelKeys);
  });
});
