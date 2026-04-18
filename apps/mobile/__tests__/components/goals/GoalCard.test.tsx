import React from "react";
import { render } from "@testing-library/react-native";
import { GoalCard } from "@/src/components/goals/GoalCard";
import { ThemeProvider } from "@/src/providers/ThemeProvider";

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("GoalCard", () => {
  const base = {
    id: "g1",
    name: "Vacation",
    target_amount: "1000",
    current_amount: "250",
    progress_pct: 25,
    pace_status: "behind" as const,
    status: "active" as const,
    celebrated_at: null,
    linked_account: null,
    target_date: "2026-10-01",
  };

  it("renders name and amount", () => {
    const { getByText } = renderWithTheme(<GoalCard goal={base} onPress={() => {}} />);
    expect(getByText("Vacation")).toBeTruthy();
    expect(getByText(/250\.00/)).toBeTruthy();
  });

  it("shows celebration variant when completed AND not yet celebrated", () => {
    const g = { ...base, status: "completed" as const, celebrated_at: null };
    const { getByText } = renderWithTheme(<GoalCard goal={g} onPress={() => {}} />);
    expect(getByText(/REACHED/)).toBeTruthy();
  });

  it("does not show celebration when already acknowledged", () => {
    const g = { ...base, status: "completed" as const, celebrated_at: "2026-04-17T00:00:00Z" };
    const { queryByText } = renderWithTheme(<GoalCard goal={g} onPress={() => {}} />);
    expect(queryByText(/REACHED/)).toBeNull();
  });
});
