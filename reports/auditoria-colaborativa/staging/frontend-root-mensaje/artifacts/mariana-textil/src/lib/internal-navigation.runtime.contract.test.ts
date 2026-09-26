import assert from "node:assert/strict";
import test from "node:test";
import {
  initializeInternalNavigation,
  saveCurrentScrollPosition,
} from "./internal-navigation";

type Listener = (event?: unknown) => void;

interface Timer {
  at: number;
  callback: () => void;
}

class FakeWindow {
  readonly history: FakeHistory;
  scrollX = 0;
  scrollY = 0;
  private now = 0;
  private nextTimer = 1;
  private readonly timers = new Map<number, Timer>();
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor() {
    this.history = new FakeHistory(this);
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  setTimeout(callback: () => void, delay: number) {
    const id = this.nextTimer++;
    this.timers.set(id, { at: this.now + delay, callback });
    return id;
  }

  clearTimeout(id: number) {
    this.timers.delete(id);
  }

  requestAnimationFrame(callback: (time: number) => void) {
    return this.setTimeout(() => callback(this.now), 16);
  }

  cancelAnimationFrame(id: number) {
    this.clearTimeout(id);
  }

  scrollTo(x: number, y: number) {
    this.scrollX = x;
    this.scrollY = y;
    this.dispatch("scroll");
  }

  advanceBy(milliseconds: number) {
    const end = this.now + milliseconds;
    while (true) {
      const due = Array.from(this.timers.entries())
        .filter(([, timer]) => timer.at <= end)
        .sort(([, left], [, right]) => left.at - right.at)[0];
      if (!due) break;
      const [id, timer] = due;
      this.timers.delete(id);
      this.now = timer.at;
      timer.callback();
    }
    this.now = end;
  }
}

class FakeHistory {
  private readonly entries = [{ state: null, url: "/" }];
  private index = 0;
  readonly calls: Array<{ type: string; state?: unknown }> = [];
  scrollRestoration: ScrollRestoration = "auto";

  constructor(private readonly owner: FakeWindow) {}

  get state() {
    return this.entries[this.index].state;
  }

  replaceState(state: unknown, _unused: string, url?: string | URL | null) {
    this.calls.push({ type: "replace", state });
    this.entries[this.index] = {
      state,
      url: url == null ? this.entries[this.index].url : String(url),
    };
  }

  pushState(state: unknown, _unused: string, url?: string | URL | null) {
    this.calls.push({ type: "push", state });
    this.entries.splice(this.index + 1);
    this.entries.push({
      state,
      url: url == null ? this.entries[this.index].url : String(url),
    });
    this.index += 1;
  }

  back() {
    this.calls.push({ type: "back" });
    if (this.index === 0) return;
    this.index -= 1;
    this.owner.dispatch("popstate", { state: this.state });
  }
}

class FakeMutationObserver {
  constructor(_callback: MutationCallback) {}

  observe() {}

  disconnect() {}
}

function installFakeBrowser(fakeWindow: FakeWindow) {
  const globalObject = globalThis as unknown as Record<string, unknown>;
  const previous = {
    window: globalObject.window,
    document: globalObject.document,
    MutationObserver: globalObject.MutationObserver,
  };
  globalObject.window = fakeWindow;
  globalObject.document = {
    body: {},
    querySelectorAll: () => [],
  };
  globalObject.MutationObserver = FakeMutationObserver;
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalObject[key];
      else globalObject[key] = value;
    }
  };
}

test("coalesces real scroll persistence and preserves positions before push/back", () => {
  const fakeWindow = new FakeWindow();
  const restoreBrowser = installFakeBrowser(fakeWindow);
  try {
    initializeInternalNavigation();
    assert.equal(fakeWindow.history.calls.length, 1);

    for (let frame = 1; frame <= 1_000; frame += 1) {
      fakeWindow.scrollY = frame;
      fakeWindow.dispatch("scroll");
      fakeWindow.advanceBy(16);
    }
    fakeWindow.advanceBy(220);

    const writesAfterBurst = fakeWindow.history.calls.filter(
      ({ type }) => type === "replace",
    ).length;
    assert.ok(writesAfterBurst <= 75, `writes: ${writesAfterBurst}`);
    assert.equal(
      (fakeWindow.history.state as {
        __marianaInternalNavigation: { scrollY: number };
      }).__marianaInternalNavigation.scrollY,
      1_000,
    );

    const writesAfterFinalPosition = fakeWindow.history.calls.length;
    fakeWindow.dispatch("scroll");
    fakeWindow.advanceBy(220);
    assert.equal(fakeWindow.history.calls.length, writesAfterFinalPosition);

    fakeWindow.scrollY = 555;
    fakeWindow.dispatch("scroll");
    const callsBeforePush = fakeWindow.history.calls.length;
    fakeWindow.history.pushState({ route: "next" }, "", "/next");
    assert.deepEqual(
      fakeWindow.history.calls.slice(callsBeforePush).map(({ type }) => type),
      ["replace", "push"],
    );
    fakeWindow.advanceBy(1_000);
    assert.equal(fakeWindow.history.calls.length, callsBeforePush + 2);

    const previousEntry = fakeWindow.history.calls[callsBeforePush].state as {
      __marianaInternalNavigation: { scrollY: number };
    };
    assert.equal(
      previousEntry.__marianaInternalNavigation.scrollY,
      555,
    );

    fakeWindow.scrollY = 777;
    fakeWindow.dispatch("scroll");
    const callsBeforeBack = fakeWindow.history.calls.length;
    saveCurrentScrollPosition();
    fakeWindow.history.back();
    assert.deepEqual(
      fakeWindow.history.calls.slice(callsBeforeBack).map(({ type }) => type),
      ["replace", "back"],
    );
    assert.equal(
      (fakeWindow.history.state as {
        __marianaInternalNavigation: { scrollY: number };
      }).__marianaInternalNavigation.scrollY,
      555,
    );
    fakeWindow.dispatch("pointerdown");
    fakeWindow.advanceBy(1_000);
    assert.equal(fakeWindow.history.calls.length, callsBeforeBack + 2);
  } finally {
    restoreBrowser();
  }
});