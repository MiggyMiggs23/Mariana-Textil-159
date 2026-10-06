import React, { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CampoEscaneo } from "./campo-escaneo";
import { advertenciaSkuEscaneado } from "@workspace/scanned-code";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
let clock = 0;
function keys(input: HTMLInputElement, code: string, gap = 65) {
  for (const key of code) {
    clock += gap;
    fireEvent.keyDown(input, { key });
    fireEvent.change(input, { target: { value: input.value + key } });
  }
  clock += gap;
  fireEvent.keyDown(input, { key: "Enter" });
}
function mount(onScan: React.ComponentProps<typeof CampoEscaneo>["onScan"], clearOnScan = false) {
  clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  function Host() {
    const [value, setValue] = useState("");
    return <CampoEscaneo value={value} onChange={setValue} onScan={onScan} clearOnScan={clearOnScan} />;
  }
  render(<Host />);
  return screen.getByRole("textbox") as HTMLInputElement;
}
test("five consecutive bursts >350ms arrive intact and FIFO while the first callback is pending", async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const received: Array<[string, string, string]> = [];
  const input = mount(async (value, code, source) => {
    received.push([value, code.textoOriginal, source]);
    if (received.length === 1) await blocked;
  });
  const codes = ["10000011", "10000012", "10000013", "10000014", "10000015"];
  for (const code of codes) {
    keys(input, code);
    expect(input.value).toBe("");
  }
  expect(received).toHaveLength(1);
  await act(async () => { release(); });
  await waitFor(() => expect(received).toHaveLength(5));
  expect(received.map(r => r[1])).toEqual(codes);
  expect(received.every(r => r[2] === "scanner")).toBe(true);
});
test("uses the DOM even when the parent value is stale", async () => {
  const handler = vi.fn();
  render(<CampoEscaneo value="STALE" onChange={() => {}} onScan={handler} />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  input.value = "10000015";
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.value).toBe("");
  await waitFor(() => expect(handler).toHaveBeenCalledOnce());
  expect(handler.mock.calls[0][1].textoOriginal).toBe("10000015");
});
test("slow typing, paste and edited input are manual, not automatically added", async () => {
  const handler = vi.fn();
  const input = mount(handler);
  keys(input, "10000011", 400);
  await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: "10000012" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
  expect(handler.mock.calls.every(call => call[2] === "manual")).toBe(true);
});
test("a failed scan reports its error and does not swallow subsequent queued scans", async () => {
  const handler = vi.fn().mockRejectedValueOnce(new Error("Rechazado")).mockResolvedValue(undefined);
  const input = mount(handler);
  keys(input, "10000011");
  keys(input, "10000012");
  await waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("alert").textContent).toContain("10000011");
});
test("a genuine label SKU mismatch is preserved without joining adjacent labels", async () => {
  const received: string[] = [];
  const warnings: Array<unknown> = [];
  const input = mount((_, code) => {
    received.push(code.textoOriginal);
    warnings.push(advertenciaSkuEscaneado(code, "GABMET170-BLA"));
  });
  keys(input, "GABMET170-BLA-10000015");
  keys(input, "OTRO-SKU-10000016");
  await waitFor(() => expect(received).toHaveLength(2));
  expect(received).toEqual(["GABMET170-BLA-10000015", "OTRO-SKU-10000016"]);
  expect(warnings[0]).toBeFalsy();
  expect(warnings[1]).toBeTruthy();
});
