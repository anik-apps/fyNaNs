import React from "react";
import { Modal } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { BudgetForm } from "@/src/components/budgets/BudgetForm";
import { ThemeProvider } from "@/src/providers/ThemeProvider";

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function fillForm(utils: ReturnType<typeof render>) {
  fireEvent.changeText(utils.getByPlaceholderText("e.g., Food & Drink"), "Food");
  fireEvent.changeText(utils.getByPlaceholderText("0.00"), "250");
}

describe("BudgetForm", () => {
  it("shows an inline error and keeps the modal open when submit fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Server exploded"));
    const onClose = jest.fn();
    const utils = renderWithTheme(
      <BudgetForm visible onClose={onClose} onSubmit={onSubmit} />
    );

    fillForm(utils);
    fireEvent.press(utils.getByText("Save"));

    expect(await utils.findByText("Server exploded")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Fields keep their values so the user can retry
    expect(utils.getByPlaceholderText("e.g., Food & Drink").props.value).toBe("Food");
  });

  it("shows a Saving state while the submit promise is pending", async () => {
    let resolveSubmit: () => void;
    const onSubmit = jest.fn(
      () => new Promise<void>((resolve) => (resolveSubmit = resolve))
    );
    const onClose = jest.fn();
    const utils = renderWithTheme(
      <BudgetForm visible onClose={onClose} onSubmit={onSubmit} />
    );

    fillForm(utils);
    fireEvent.press(utils.getByText("Save"));

    expect(await utils.findByText("Saving…")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    resolveSubmit!();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("ignores back/swipe dismissal while a submit is in flight", async () => {
    let resolveSubmit: () => void;
    const onSubmit = jest.fn(
      () => new Promise<void>((resolve) => (resolveSubmit = resolve))
    );
    const onClose = jest.fn();
    const utils = renderWithTheme(
      <BudgetForm visible onClose={onClose} onSubmit={onSubmit} />
    );

    fillForm(utils);
    fireEvent.press(utils.getByText("Save"));
    expect(await utils.findByText("Saving…")).toBeTruthy();

    // Android back button / iOS swipe-dismiss fire the Modal's onRequestClose
    fireEvent(utils.UNSAFE_getByType(Modal as any), "requestClose");
    expect(onClose).not.toHaveBeenCalled();

    resolveSubmit!();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("closes the modal and resets fields on success", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const utils = renderWithTheme(
      <BudgetForm visible onClose={onClose} onSubmit={onSubmit} />
    );

    fillForm(utils);
    fireEvent.press(utils.getByText("Save"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      category_name: "Food",
      limit_amount: 250,
      period: "monthly",
    });
    expect(utils.getByPlaceholderText("e.g., Food & Drink").props.value).toBe("");
  });
});
