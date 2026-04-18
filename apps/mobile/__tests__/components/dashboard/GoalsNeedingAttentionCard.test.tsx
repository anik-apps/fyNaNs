import React from "react";
import { render } from "@testing-library/react-native";
import { GoalsNeedingAttentionCard } from "@/src/components/dashboard/GoalsNeedingAttentionCard";
import { ThemeProvider } from "@/src/providers/ThemeProvider";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

function r(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("GoalsNeedingAttentionCard", () => {
  it("renders empty-state when no active goals", () => {
    const { getByText } = r(<GoalsNeedingAttentionCard topGoals={[]} activeCount={0} />);
    expect(getByText(/Set a goal/i)).toBeTruthy();
  });

  it("renders all-on-track when active but none behind", () => {
    const top = [{
      id: "g1", name: "V", target_amount: "1000", current_amount: "500",
      progress_pct: 50, pace_status: "ahead" as const, target_date: null,
    }];
    const { getByText } = r(<GoalsNeedingAttentionCard topGoals={top} activeCount={1} />);
    expect(getByText(/on track/i)).toBeTruthy();
  });

  it("renders needing-attention list when behind goals exist", () => {
    const top = [{
      id: "g1", name: "Emergency", target_amount: "10000", current_amount: "1000",
      progress_pct: 10, pace_status: "behind" as const, target_date: "2026-12-31",
    }];
    const { getByText } = r(<GoalsNeedingAttentionCard topGoals={top} activeCount={1} />);
    expect(getByText("Emergency")).toBeTruthy();
    expect(getByText(/Goals Needing Attention/i)).toBeTruthy();
  });
});
