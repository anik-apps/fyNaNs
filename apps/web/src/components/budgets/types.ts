export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  amount_limit: string;
  amount_spent: string;
  percent_spent: number;
  period: string;
}
