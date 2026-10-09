import React from "react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SidebarSection, useSidebarSections } from "./layout/sidebar-sections";

function Host({ userId = 1, location = "/home" }: { userId?: number; location?: string }) {
  const sections = useSidebarSections(userId, location);
  return <SidebarSection title="INVENTARIO" sections={sections} active={location.startsWith("/inventario")}>
    <a href="/inventario">Inventario</a>
  </SidebarSection>;
}
const expanded = () => screen.getByRole("button", { name: "INVENTARIO" }).getAttribute("aria-expanded");
const toggle = () => fireEvent.click(screen.getByRole("button", { name: "INVENTARIO" }));
beforeEach(() => localStorage.clear());
afterEach(cleanup);
test("open by default; persists closed across a full remount", () => {
  const view = render(<Host />);
  expect(expanded()).toBe("true");
  toggle();
  expect(expanded()).toBe("false");
  expect(screen.queryByRole("link")).toBeNull();
  view.unmount();
  render(<Host />);
  expect(expanded()).toBe("false");
});
test("another user never inherits state, including a same-component identity switch", () => {
  const view = render(<Host />);
  toggle();
  view.rerender(<Host userId={2} />);
  expect(expanded()).toBe("true");
  view.rerender(<Host userId={1} />);
  expect(expanded()).toBe("false");
});
test("route auto-opens without replacing closed preference; click still toggles", () => {
  const view = render(<Host />);
  toggle();
  view.rerender(<Host location="/inventario/rollos/12" />);
  expect(expanded()).toBe("true");
  expect(JSON.parse(localStorage.getItem("mariana:sidebar-sections:v1:1")!).INVENTARIO).toBe(false);
  toggle();
  expect(expanded()).toBe("false");
  view.unmount();
  const again = render(<Host location="/inventario/rollos/12" />);
  expect(expanded()).toBe("true");
  again.rerender(<Host location="/home" />);
  expect(expanded()).toBe("false");
});
test("malformed storage does not break menu; hidden content is not keyboard-focusable", () => {
  localStorage.setItem("mariana:sidebar-sections:v1:1", "not json");
  render(<Host />);
  expect(expanded()).toBe("true");
  toggle();
  const target = document.getElementById(screen.getByRole("button").getAttribute("aria-controls")!);
  expect(target?.hidden).toBe(true);
});
