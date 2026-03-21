import {
  ArrowLeftRight,
  Banknote,
  Coffee,
  CreditCard,
  Film,
  Gift,
  GraduationCap,
  Heart,
  Home,
  type LucideIcon,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react-native";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Income": Banknote, "Salary": Banknote, "Freelance": Banknote, "Other Income": Banknote,
  "Investments": TrendingUp,
  "Food & Drink": Utensils, "Groceries": ShoppingBag, "Restaurants": Coffee,
  "Transportation": Truck, "Gas": Zap, "Public Transit": Truck, "Rideshare": Truck,
  "Housing": Home, "Rent": Home, "Mortgage": Home, "Utilities": Zap,
  "Shopping": ShoppingBag, "Clothing": ShoppingBag, "Electronics": Package, "General": Package,
  "Entertainment": Film, "Streaming": Film, "Events": Film, "Hobbies": Film,
  "Health": Heart, "Doctor": Heart, "Pharmacy": Heart, "Fitness": Heart,
  "Insurance": CreditCard, "Education": GraduationCap,
  "Personal": Wallet, "Gifts & Donations": Gift, "Fees & Charges": Receipt,
  "Transfer": ArrowLeftRight, "Uncategorized": Package,
};

export function getCategoryIcon(categoryName: string): LucideIcon {
  return CATEGORY_ICONS[categoryName] ?? Package;
}

export function getCategoryIconBg(hexColor: string): string {
  // Parse hex color and return rgba string at 15% opacity
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.15)`;
}
