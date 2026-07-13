import React from "react";
import { Modal } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { BillForm } from "@/src/components/bills/BillForm";
import { ThemeProvider } from "@/src/providers/ThemeProvider";

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function fillForm(utils: ReturnType<typeof render>) {
  fireEvent.changeText(utils.getByPlaceholderText("e.g., Netflix"), "Netflix");
  fireEvent.changeText(utils.getByPlaceholderText("0.00"), "15.99");
}

describe("BillForm", () => {
  it("shows an inline error and keeps the modal open when submit fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Network request failed"));
    const onClose = jest.fn();
    const utils = renderWithTheme(
      <BillForm visible onClose={onClose} onSubmit={onSubmit} />
    );

    fillForm(utils);
    fireEvent.press(utils.getByText("Save"));

    expect(await utils.findByText("Network request failed")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Fields keep their values so the user can retry
    expect(utils.getByPlaceholderText("e.g., Netflix").props.value).toBe("Netflix");
  });

  it("shows a Saving state while the submit promise is pending", async () => {
    let resolveSubmit: () => void;
    const onSubmit = jest.fn(
      () => new Promise<void>((resolve) => (resolveSubmit = resolve))
    );
    const onClose = jest.fn();
    const utils = renderWithTheme(
      <BillForm visible onClose={onClose} onSubmit={onSubmit} />
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
      <BillForm visible onClose={onClose} onSubmit={onSubmit} />
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
      <BillForm visible onClose={onClose} onSubmit={onSubmit} />
    );

    fillForm(utils);
    fireEvent.press(utils.getByText("Save"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Netflix",
      amount: 15.99,
      frequency: "monthly",
      day_of_month: 1,
      is_auto_pay: false,
      reminder_days: 3,
    });
    expect(utils.getByPlaceholderText("e.g., Netflix").props.value).toBe("");
  });
});
