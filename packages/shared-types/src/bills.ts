export const BILL_FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type BillFrequency = (typeof BILL_FREQUENCIES)[number];

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const BILL_STATUS = {
  AUTO_PAY: "auto_pay",
  DUE_SOON: "due_soon",
  OVERDUE: "overdue",
  UPCOMING: "upcoming",
} as const;

export type BillStatus = (typeof BILL_STATUS)[keyof typeof BILL_STATUS];

export function getBillStatus(daysUntilDue: number, isAutoPay: boolean): BillStatus {
  if (daysUntilDue < 0) return BILL_STATUS.OVERDUE; // Overdue takes priority, even for auto-pay
  if (isAutoPay) return BILL_STATUS.AUTO_PAY; // Scheduled for auto-payment
  if (daysUntilDue <= 3) return BILL_STATUS.DUE_SOON;
  return BILL_STATUS.UPCOMING;
}
