import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RemateControl } from "./tarea4-remate";

// Tanda D tarea 1: marca configurable; retiro ADMIN con motivo, sin mutar antes de éxito.
afterEach(cleanup);
test("marca exige motivo y envía el rollo exacto; muestra error real", async () => {
  const onMark = vi.fn().mockRejectedValue(new Error("Sin permiso Marcar remate."));
  render(<RemateControl rolloId={7} marked={false} canMark onMark={onMark} />);
  const button = screen.getByRole("button", { name: "Marcar remate" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Liquidación  " } });
  fireEvent.click(button);
  await waitFor(() => expect(onMark).toHaveBeenCalledWith(7, "Liquidación"));
  expect((await screen.findByRole("alert")).textContent).toContain("Sin permiso");
});
test("solo control autorizado puede retirar y requiere motivo", async () => {
  const onRemove = vi.fn().mockResolvedValue(undefined);
  const onMark = vi.fn();
  const view = render(<RemateControl rolloId={9} marked canMark onMark={onMark} />);
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<RemateControl rolloId={9} marked canMark canRemove onMark={onMark} onRemove={onRemove} />);
  const button = screen.getByRole("button", { name: "Retirar remate" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Error de clasificación" } });
  fireEvent.click(button);
  await waitFor(() => expect(onRemove).toHaveBeenCalledWith(9, "Error de clasificación"));
  expect(onMark).not.toHaveBeenCalled();
});