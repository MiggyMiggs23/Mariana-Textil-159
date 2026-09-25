// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as api from "@workspace/api-client-react";
import * as audio from "./notification-audio-controller";

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetNotificationFeed: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

type Event = { id: string; updatedAt: string; family: api.NotificationFamily };
const instant = "2026-09-25T10:00:00Z";
const event = (id: string, family: api.NotificationFamily = api.NotificationFamily.ALERTA, updatedAt = instant): Event =>
  ({ id, family, updatedAt });
const tones: string[] = [];
const fetched: string[] = [];
let feed: { sessionKey: string; events: Event[] };
let lockAvailable = true;
let lockOwner = false;
let lockChain: Promise<unknown> = Promise.resolve();

class AudioContextStub {
  state: AudioContextState = "running";
  destination = {};
  onstatechange: (() => void) | null = null;
  async resume() { this.state = "running"; this.onstatechange?.(); }
  async close() { this.state = "closed"; }
  async decodeAudioData(data: ArrayBuffer) {
    return { url: new TextDecoder().decode(data) } as unknown as AudioBuffer;
  }
  createBufferSource() {
    const source = {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      addEventListener: (_name: string, callback: () => void) => { source.ended = callback; },
      ended: () => {},
      start: () => {
        tones.push((source.buffer as unknown as { url: string }).url);
        queueMicrotask(() => source.ended());
      },
      stop: () => source.ended(),
    };
    return source as unknown as AudioBufferSourceNode;
  }
}

function Controls() {
  const controls = audio.useNotificationAudio();
  return <button onClick={() => controls.setEnabled(!controls.enabled)}>
    {controls.enabled ? "Desactivar sonido" : "Activar sonido"}
  </button>;
}
function AppHarness({ navigation = "/inicio", userId = 12 }: { navigation?: string; userId?: number }) {
  const Controller = audio.NotificationAudioController as React.ComponentType<{
    userId: number; role: api.Role; navigationKey?: string; children?: React.ReactNode;
  }>;
  return <div>
    <span id="notification-audio-mobile-slot" />
    <span id="notification-audio-desktop-slot" />
    <Controller userId={userId} role={api.Role.ADMIN} navigationKey={navigation}>
      <span data-testid="route">{navigation}</span>
      {typeof audio.useNotificationAudio === "function" && <Controls />}
    </Controller>
  </div>;
}

function mount(navigation = "/inicio", userId = 12) {
  const view = render(<AppHarness navigation={navigation} userId={userId} />);
  return {
    ...view,
    route(next: string) { view.rerender(<AppHarness navigation={next} userId={userId} />); },
    feed(next: Event[], sessionKey = feed.sessionKey) {
      feed = { events: next, sessionKey };
      view.rerender(<AppHarness navigation={navigation} userId={userId} />);
    },
  };
}
async function enabled() {
  fireEvent.click(screen.getByRole("button", { name: /activar sonido/i }));
  await waitFor(() => expect(lockOwner).toBe(true));
}
async function count(n: number) {
  await waitFor(() => expect(tones).toHaveLength(n));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  tones.length = 0;
  fetched.length = 0;
  feed = { sessionKey: "session-A", events: [event("old")] };
  lockAvailable = true;
  lockOwner = false;
  lockChain = Promise.resolve();
  vi.mocked(api.useGetNotificationFeed).mockImplementation(() => ({
    data: feed, isFetching: false, isFetchedAfterMount: true,
  } as ReturnType<typeof api.useGetNotificationFeed>));
  vi.stubGlobal("AudioContext", AudioContextStub);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    fetched.push(String(url));
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(String(url)).buffer };
  }));
  Object.defineProperty(navigator, "locks", { configurable: true, get: () => lockAvailable ? {
    request: (_name: string, _options: unknown, callback: () => Promise<void>) => {
      const acquired = lockChain.then(async () => {
        lockOwner = true;
        try { await callback(); } finally { lockOwner = false; }
      });
      lockChain = acquired.catch(() => {});
      return acquired;
    },
  } : undefined });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("mounted notification audio", () => {
  it.skipIf(!process.env.NOTIFICATION_AUDIO_HEAD)("HEAD baseline: activation and route navigation must not emit a tone", async () => {
    sessionStorage.setItem("mariana:notification-audio:activated:session-A", "1");
    const view = mount();
    await waitFor(() => expect(lockOwner).toBe(true));
    view.route("/inventario");
    await waitFor(() => expect(tones).toHaveLength(0));
  });
  it("route navigation, remount and reload with an activated preference stay silent; a new alert plays once", async () => {
    const view = mount();
    await enabled();
    await count(0);
    view.route("/inventario");
    await count(0);
    view.unmount();
    render(<AppHarness navigation="/inventario" />);
    await count(0);
    cleanup();
    render(<AppHarness navigation="/inventario" />);
    await waitFor(() => expect(lockOwner).toBe(true));
    await count(0);
    cleanup();
    await waitFor(() => expect(lockOwner).toBe(false));
    const live = mount("/inventario");
    await waitFor(() => expect(lockOwner).toBe(true));
    live.feed([event("old"), event("newer")]);
    await count(1);
    expect(tones[0]).toMatch(/alerta\.ogg$/);
    live.feed([event("old"), event("newer")]);
    await count(1);
  });

  it("refetches, updatedAt-only changes and mark-read changes cannot retrigger a tone", async () => {
    const view = mount();
    await enabled();
    view.feed([event("old"), event("new")]);
    await count(1);
    view.feed([event("old"), event("new")]);
    view.feed([event("old"), event("new", api.NotificationFamily.ALERTA, "2026-09-25T11:00:00Z")]);
    view.feed([event("old")]);
    view.feed([event("old"), event("new", api.NotificationFamily.ALERTA, "2026-09-25T11:00:00Z")]);
    await count(1);
  });

  it("turning audio off then on keeps preference and does not replay the backlog", async () => {
    const view = mount();
    await enabled();
    const disable = screen.getByRole("button", { name: /desactivar sonido/i });
    fireEvent.click(disable);
    view.feed([event("old"), event("while-off")]);
    expect(tones).toHaveLength(0);
    await enabled();
    expect(tones).toHaveLength(0);
    expect(localStorage.getItem("mariana:notification-audio:enabled:12")).toBe("1");
    view.feed([event("old"), event("while-off"), event("after-on")]);
    await count(1);
  });

  it("distinguishes payment PAGO, feed ALERTA and bell AVISO by decoded audio URL", async () => {
    const view = mount();
    await enabled();
    view.feed([event("old"), event("alert")]);
    await count(1);
    audio.requestAppSound("PAGO", "payment:42");
    await count(2);
    audio.requestAppSound("PAGO", "payment:42");
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(tones).toHaveLength(2);
    view.feed([event("old"), event("alert"), event("bell", api.NotificationFamily.AVISO)]);
    await count(3);
    expect(tones.map(url => url.split("/").pop())).toEqual(["alerta.ogg", "solicitud.ogg", "aviso.ogg"]);
    expect(fetched.map(url => url.split("/").pop())).toEqual(["alerta.ogg", "solicitud.ogg", "aviso.ogg"]);
  });

  it("fails closed without cross-tab locks and scopes activation by session/user", async () => {
    lockAvailable = false;
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: /activar sonido/i }));
    view.feed([event("old"), event("alert")]);
    audio.requestAppSound(api.NotificationFamily.AVISO);
    expect(tones).toHaveLength(0);
    view.unmount();
    feed = { sessionKey: "session-B", events: [event("old")] };
    mount("/inicio", 24);
    expect(screen.getAllByRole("button", { name: /activar sonido/i }).length).toBeGreaterThan(0);
    expect(tones).toHaveLength(0);
  });

  it("an exclusive lock permits only one mounted tab to sound the same new event", async () => {
    const first = mount();
    await enabled();
    const second = render(<AppHarness />);
    first.feed([event("old"), event("shared-alert")]);
    second.rerender(<AppHarness />);
    await count(1);
    expect(tones[0]).toMatch(/alerta\.ogg$/);
    first.feed([event("old"), event("shared-alert")]);
    second.rerender(<AppHarness />);
    expect(tones).toHaveLength(1);
  });
});