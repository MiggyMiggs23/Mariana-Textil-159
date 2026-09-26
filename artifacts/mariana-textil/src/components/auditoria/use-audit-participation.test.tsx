import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as api from "@workspace/api-client-react";
import { AUDIT_HEARTBEAT_MS, auditParticipantLimit, useAuditParticipation } from "./use-audit-participation";

function lease(seconds = 90) {
  return { participantesActivos: 5, maxParticipantes: 5, expiracionSegundos: seconds,
    expiraAt: new Date(Date.now() + seconds * 1000).toISOString() };
}

function Station({ id = 41, userId = 7, eligible = true }: { id?: number; userId?: number; eligible?: boolean }) {
  const participation = useAuditParticipation(id, userId, eligible);
  return <div>
    <output data-testid="state">{participation.active ? "joined" : participation.joining ? "joining" : "blocked"}</output>
    <button onClick={participation.retry}>retry</button>
    <button disabled={!participation.active} onClick={() => {}}>scan</button>
  </div>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mounted audit admission lifecycle", () => {
  test("fails closed until admitted, renews every 20s, blocks on failure and retries", async () => {
    vi.useFakeTimers();
    let admit!: (value: ReturnType<typeof lease>) => void;
    const request = vi.spyOn(api, "customFetch")
      .mockImplementationOnce(() => new Promise((resolve) => { admit = resolve; }) as any)
      .mockImplementationOnce(() => Promise.reject({ data: { code: "AUDIT_PARTICIPANT_LIMIT" } }))
      .mockImplementation(() => Promise.resolve(lease()) as any);
    const view = render(<Station />);
    expect((screen.getByRole("button", { name: "scan" }) as HTMLButtonElement).disabled).toBe(true);
    expect(request).toHaveBeenCalledWith("/api/inventario/auditorias/41/participar", { method: "POST" });
    await act(async () => { admit(lease()); });
    expect(screen.getByTestId("state").textContent).toBe("joined");
    await act(async () => { vi.advanceTimersByTime(AUDIT_HEARTBEAT_MS); });
    expect(screen.getByTestId("state").textContent).toBe("blocked");
    expect((screen.getByRole("button", { name: "scan" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByText("retry")); });
    expect(screen.getByTestId("state").textContent).toBe("joined");
    view.unmount();
    const count = request.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(AUDIT_HEARTBEAT_MS * 2); });
    expect(request).toHaveBeenCalledTimes(count);
  });

  test("late response for old audit/user cannot authorize current audit", async () => {
    let oldAdmit!: (value: ReturnType<typeof lease>) => void;
    let nextAdmit!: (value: ReturnType<typeof lease>) => void;
    const request = vi.spyOn(api, "customFetch")
      .mockImplementationOnce(() => new Promise((resolve) => { oldAdmit = resolve; }) as any)
      .mockImplementationOnce(() => new Promise((resolve) => { nextAdmit = resolve; }) as any);
    const view = render(<Station />);
    view.rerender(<Station id={42} userId={8} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await act(async () => { oldAdmit(lease()); });
    expect((screen.getByRole("button", { name: "scan" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { nextAdmit(lease()); });
    expect(screen.getByTestId("state").textContent).toBe("joined");
    view.rerender(<Station id={42} userId={8} eligible={false} />);
    expect((screen.getByRole("button", { name: "scan" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("ineligible audit never joins and concurrent retries cannot admit twice", async () => {
    let admit!: (value: ReturnType<typeof lease>) => void;
    const request = vi.spyOn(api, "customFetch")
      .mockImplementation(() => new Promise((resolve) => { admit = resolve; }) as any);
    const view = render(<Station eligible={false} />);
    expect(request).not.toHaveBeenCalled();
    view.rerender(<Station eligible />);
    fireEvent.click(screen.getByText("retry"));
    fireEvent.click(screen.getByText("retry"));
    expect(request).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "scan" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { admit(lease()); });
    expect(screen.getByTestId("state").textContent).toBe("joined");
  });

  test("expired lease blocks scanner even if heartbeat was throttled", async () => {
    vi.useFakeTimers();
    vi.spyOn(api, "customFetch").mockResolvedValue(lease(1) as any);
    render(<Station />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("state").textContent).toBe("joined");
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect((screen.getByRole("button", { name: "scan" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("only canonical sixth-user code is recognized", () => {
    expect(auditParticipantLimit({ data: { code: "AUDIT_PARTICIPANT_LIMIT" } })).toBe(true);
    expect(auditParticipantLimit({ data: { code: "OTHER" } })).toBe(false);
  });
});