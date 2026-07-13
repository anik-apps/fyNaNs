// Shape of BillResponse from GET /api/bills — limited to the fields the web
// UI actually consumes. The API does not return days_until_due or
// category_name; days until due are derived client-side from next_due_date.
export interface Bill {
  id: string;
  name: string;
  amount: string;
  frequency: string;
  day_of_month: number | null;
  next_due_date: string;
  reminder_days: number;
  is_auto_pay: boolean;
}
