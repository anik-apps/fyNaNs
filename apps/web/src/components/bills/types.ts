export interface Bill {
  id: string;
  name: string;
  amount: string;
  frequency: string;
  day_of_month: number | null;
  next_due_date: string;
  reminder_days: number;
  is_auto_pay: boolean;
  days_until_due: number;
  category_name: string | null;
}
