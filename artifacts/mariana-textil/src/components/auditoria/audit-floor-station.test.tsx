import React, { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AuditFloor } from "./use-audit-floors";
import { AuditFloorStation, isMobileAuditDevice } from "./audit-floor-station";

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => {
    const [trigger, content] = React.Children.toArray(children) as React.ReactElement<any>[];
    return <select data-testid={trigger.props["data-testid"]} value={value}
      onChange={(event) => onValueChange(event.target.value)}>
      <option value="" disabled>Seleccionar</option>
      {content.props.children}
    </select>;
  },
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

const floors = [
  { id: 11, ubicacionId: 1, nombre: "Primer piso", activo: true },
  { id: 12, ubicacionId: 1, nombre: "Segundo piso", activo: true },
  { id: 13, ubicacionId: 1, nombre: "Tercer piso", activo: true },
] as AuditFloor[];

function Participant({ userId, initialFloor, onScan }: {
  userId: number;
  initialFloor: number | null;
  onScan: (userId: number, floorId: number | null) => void;
}) {
  const [floorId, setFloorId] = useState(initialFloor);
  return (
    <section data-testid={`participant-${userId}`}>
      <AuditFloorStation floors={floors} ready error={false} mobile joined
        selectedId={floorId} onSelect={setFloorId} />
      <button data-testid={`scan-${userId}`} disabled={floorId == null} onClick={() => onScan(userId, floorId)}>Escanear {userId}</button>
    </section>
  );
}

afterEach(() => cleanup());

test("three mounted participants keep their own independently confirmed real floors", () => {
  const onScan = vi.fn();
  render(<>
    <Participant userId={7} initialFloor={null} onScan={onScan} />
    <Participant userId={8} initialFloor={12} onScan={onScan} />
    <Participant userId={9} initialFloor={13} onScan={onScan} />
  </>);
  const first = within(screen.getByTestId("participant-7"));
  const second = within(screen.getByTestId("participant-8"));
  const third = within(screen.getByTestId("participant-9"));
  expect((first.getByTestId("scan-7") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByTestId("select-audit-floor"), { target: { value: "11" } });
  fireEvent.click(screen.getByTestId("button-continue-audit-floor"));
  fireEvent.click(screen.getByTestId("button-confirm-audit-floor"));
  expect(first.getByTestId("audit-floor-name").textContent).toBe("Primer piso");
  expect(second.getByTestId("audit-floor-name").textContent).toBe("Segundo piso");
  expect(third.getByTestId("audit-floor-name").textContent).toBe("Tercer piso");
  fireEvent.click(first.getByTestId("scan-7"));
  fireEvent.click(second.getByTestId("scan-8"));
  fireEvent.click(third.getByTestId("scan-9"));
  expect(onScan.mock.calls).toEqual([[7, 11], [8, 12], [9, 13]]);
});

test("mobile classification matches the backend UA heuristic, independent of viewport", () => {
  expect(isMobileAuditDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile")).toBe(true);
  expect(isMobileAuditDevice("Mozilla/5.0 (Linux; Android 14; Tablet)")).toBe(true);
  expect(isMobileAuditDevice("Mozilla/5.0 (X11; Linux x86_64)")).toBe(false);
});