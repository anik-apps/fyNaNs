export const BILL_FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type BillFrequency = (typeof BILL_FREQUENCIES)[number];

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const BILL_STATUS = {
  PAID: "paid",
  DUE_SOON: "due_soon",
  OVERDUE: "overdue",
  UPCOMING: "upcoming",
} as const;

export type BillStatus = (typeof BILL_STATUS)[keyof typeof BILL_STATUS];

export function getBillStatus(daysUntilDue: number, isAutoPay: boolean): BillStatus {
  if (isAutoPay) return BILL_STATUS.PAID;
  if (daysUntilDue < 0) return BILL_STATUS.OVERDUE;
  if (daysUntilDue <= 3) return BILL_STATUS.DUE_SOON;
  return BILL_STATUS.UPCOMING;
}
