// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";
vi.mock("../../lib/i18n", async importOriginal => {
  const original = await importOriginal<typeof import("../../lib/i18n")>();
  return { ...original, useLanguage: () => ({ language: "en", t: (key: string) => original.TRANSLATIONS.en[key] ?? key }) };
});
afterEach(cleanup);
it("identifies and focuses the first invalid field, with the same error associated with every invalid field", () => {
  const save = vi.fn(); render(<ProfileForm submitLabel="Save" onSubmit={save} />);
  const name = screen.getByTestId("input-name"), date = screen.getByTestId("input-birthdate");
  fireEvent.click(screen.getByTestId("button-save-profile"));
  expect(document.activeElement).toBe(name);
  for (const field of [name, date]) {
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  }
  fireEvent.change(name, { target: { value: "Fictional Reader" } });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  expect(document.activeElement).toBe(date); expect(name.getAttribute("aria-invalid")).toBe("false");
  expect(save).not.toHaveBeenCalled();
});
it("brings storage failure into focus without marking valid fields invalid, retains values and permits explicit retry", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("Fictional storage denial")).mockResolvedValueOnce(undefined);
  render(<ProfileForm submitLabel="Save" onSubmit={save} />);
  fireEvent.change(screen.getByTestId("input-name"), { target: { value: "Fictional Reader" } });
  fireEvent.change(screen.getByTestId("input-birthdate"), { target: { value: "2000-02-29" } });
  fireEvent.click(screen.getByTestId("button-save-profile"));
  const alert = await screen.findByRole("alert");
  expect(document.activeElement).toBe(alert);
  expect(screen.getByTestId("button-save-profile").getAttribute("aria-describedby")).toBe(alert.id);
  expect(screen.getByTestId("input-name").getAttribute("aria-invalid")).toBe("false");
  expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe("Fictional Reader");
  fireEvent.click(screen.getByTestId("button-save-profile"));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).toBeNull();
});
