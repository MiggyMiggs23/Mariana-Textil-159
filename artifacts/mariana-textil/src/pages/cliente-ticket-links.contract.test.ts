import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import {
  ResponsiveTable,
  type ResponsiveTableRow,
} from "../components/client-responsive-table";

test("the second client ticket row links by its real ticket id, not by list position", () => {
  const rows: ResponsiveTableRow[] = [
    {
      id: "movement-7001",
      ticketId: 501,
      cells: ["1 sep 2026", "VENTA_CREDITO", "12001"],
    },
    {
      id: "movement-7002",
      ticketId: 9427,
      cells: ["2 sep 2026", "VENTA_CREDITO", "12002"],
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(
      Router,
      { ssrPath: "/" },
      React.createElement(ResponsiveTable, {
        headers: ["Fecha", "Tipo", "Folio"],
        rows,
        empty: "No hay movimientos.",
      }),
    ),
  );

  assert.match(html, /href="\/tickets\/9427"[^>]*>12002<\/a>/);
  assert.doesNotMatch(html, /href="\/tickets\/1"/);
});