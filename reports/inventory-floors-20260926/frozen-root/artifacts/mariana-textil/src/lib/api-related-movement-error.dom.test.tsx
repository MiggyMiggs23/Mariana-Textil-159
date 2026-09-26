import React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiErrorDetails } from "./api-error";

afterEach(cleanup);

describe("ApiErrorDetails related inventory movement", () => {
  test("renders the backend explanation and exact roll movement link", () => {
    render(<ApiErrorDetails error={{
      data: {
        error: "La baja original ya fue reactivada y no puede reversarse.",
        code: "BAJA_YA_REACTIVADA",
        movimientoRelacionado: {
          rolloId: 999,
          movimientoId: 701,
          href: "/inventario/rollos/999?movimientoId=701",
        },
      },
    }} />);

    expect(screen.getByText("La baja original ya fue reactivada y no puede reversarse.")).toBeTruthy();
    expect(screen.getByTestId("link-related-inventory-movement").getAttribute("href")).toBe(
      "/inventario/rollos/999?movimientoId=701",
    );
  });

  test("does not render a link when the supplied href does not exactly identify the related movement", () => {
    render(<ApiErrorDetails error={{
      data: {
        error: "No se pudo completar.",
        code: "BAJA_YA_REACTIVADA",
        movimientoRelacionado: {
          rolloId: 999,
          movimientoId: 701,
          href: "//example.test/inventario/rollos/999?movimientoId=701",
        },
      },
    }} />);

    expect(screen.getByText("No se pudo completar.")).toBeTruthy();
    expect(screen.queryByTestId("link-related-inventory-movement")).toBeNull();
  });
});