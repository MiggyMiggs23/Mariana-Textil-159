import React, {
  type ComponentProps,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";

const NAVIGATION_STATE_KEY = "__marianaInternalNavigation";
const PAGE_STATE_KEY = "__marianaPageState";
const TRACKER_KEY = "__marianaInternalNavigationTracker";
const globalStateCache = new Map<string, unknown>();
let activeScrollRestoration: (() => void) | null = null;

interface NavigationEntryState {
  sessionId: string;
  entryId: string;
  depth: number;
  scrollX: number;
  scrollY: number;
  scrollContainers?: Record<string, { x: number; y: number }>;
}

interface NavigationTracker {
  sessionId: string;
  originalReplaceState: History["replaceState"];
}

type TrackedWindow = Window &
  typeof globalThis & {
    [TRACKER_KEY]?: NavigationTracker;
  };

function objectState(state: unknown): Record<string, unknown> {
  return state != null && typeof state === "object"
    ? (state as Record<string, unknown>)
    : {};
}

function navigationEntry(state: unknown): NavigationEntryState | null {
  const entry = objectState(state)[NAVIGATION_STATE_KEY];
  if (
    entry == null ||
    typeof entry !== "object" ||
    typeof (entry as NavigationEntryState).sessionId !== "string" ||
    typeof (entry as NavigationEntryState).entryId !== "string" ||
    typeof (entry as NavigationEntryState).depth !== "number"
  ) {
    return null;
  }
  return entry as NavigationEntryState;
}

function entryId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function trackedState(state: unknown, entry: NavigationEntryState) {
  return {
    ...objectState(state),
    [NAVIGATION_STATE_KEY]: entry,
  };
}

export function stateForNewEntry(
  state: unknown,
  currentState: unknown,
  cachedGlobalState: ReadonlyMap<string, unknown> = globalStateCache,
) {
  const requestedState = objectState(state);
  const requestedPageState = objectState(requestedState[PAGE_STATE_KEY]);
  const currentPageState = objectState(
    objectState(currentState)[PAGE_STATE_KEY],
  );
  const inheritedGlobalState = Object.fromEntries(
    Object.entries(currentPageState).filter(([key]) => key.startsWith("global.")),
  );
  const pageState = {
    ...inheritedGlobalState,
    ...Object.fromEntries(cachedGlobalState),
    ...requestedPageState,
  };

  return Object.keys(pageState).length
    ? { ...requestedState, [PAGE_STATE_KEY]: pageState }
    : requestedState;
}

export function hasSafeInternalPreviousEntry(
  state: unknown,
  sessionId: string,
) {
  const entry = navigationEntry(state);
  return entry?.sessionId === sessionId && entry.depth > 0;
}

export function appHref(path: string, baseUrl = import.meta.env.BASE_URL) {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function cancelActiveScrollRestoration() {
  activeScrollRestoration?.();
  activeScrollRestoration = null;
}

export function initializeInternalNavigation() {
  if (typeof window === "undefined") return;

  const trackedWindow = window as TrackedWindow;
  if (trackedWindow[TRACKER_KEY]) return;

  const sessionId = entryId();
  const history = window.history;
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  trackedWindow[TRACKER_KEY] = { sessionId, originalReplaceState };
  originalReplaceState(
    trackedState(history.state, {
      sessionId,
      entryId: entryId(),
      depth: 0,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollContainers: readScrollContainers(),
    }),
    "",
  );

  history.pushState = ((state: unknown, unused: string, url?: string | URL | null) => {
    cancelActiveScrollRestoration();
    saveCurrentScrollPosition();
    const current = navigationEntry(history.state);
    originalPushState(
      trackedState(stateForNewEntry(state, history.state), {
        sessionId,
        entryId: entryId(),
        depth: current?.sessionId === sessionId ? current.depth + 1 : 1,
        scrollX: 0,
        scrollY: 0,
        scrollContainers: {},
      }),
      unused,
      url,
    );
  }) as History["pushState"];

  history.replaceState = ((state: unknown, unused: string, url?: string | URL | null) => {
    const current = navigationEntry(history.state);
    originalReplaceState(
      trackedState(
        state,
        current?.sessionId === sessionId
          ? current
          : {
              sessionId,
              entryId: entryId(),
              depth: 0,
              scrollX: window.scrollX,
              scrollY: window.scrollY,
              scrollContainers: readScrollContainers(),
            },
      ),
      unused,
      url,
    );
  }) as History["replaceState"];

  let scrollFrame = 0;
  window.addEventListener(
    "scroll",
    () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(saveCurrentScrollPosition);
    },
    { passive: true },
  );

  window.history.scrollRestoration = "manual";
  window.addEventListener("popstate", (event) => {
    cancelActiveScrollRestoration();
    const destination = navigationEntry(event.state);
    if (destination?.sessionId !== sessionId) return;
    activeScrollRestoration = restoreScrollPosition(
      destination.scrollX,
      destination.scrollY,
      destination.scrollContainers ?? {},
    );
  });
}

function readScrollContainers() {
  return Object.fromEntries(
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-history-scroll-key]"),
    ).map((element) => [
      element.dataset.historyScrollKey!,
      { x: element.scrollLeft, y: element.scrollTop },
    ]),
  );
}

export function saveCurrentScrollPosition() {
  if (typeof window === "undefined") return;
  const trackedWindow = window as TrackedWindow;
  const tracker = trackedWindow[TRACKER_KEY];
  const current = navigationEntry(window.history.state);
  if (!tracker || current?.sessionId !== tracker.sessionId) return;

  tracker.originalReplaceState(
    trackedState(window.history.state, {
      ...current,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollContainers: readScrollContainers(),
    }),
    "",
  );
}

function restoreScrollPosition(
  x: number,
  y: number,
  scrollContainers: Record<string, { x: number; y: number }>,
) {
  const startedAt = performance.now();
  let cancelled = false;
  let observer: MutationObserver | null = null;
  const timers: number[] = [];

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    observer?.disconnect();
    timers.forEach(window.clearTimeout);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("pointerdown", stop);
    if (activeScrollRestoration === stop) {
      activeScrollRestoration = null;
    }
  };

  const attempt = () => {
    if (cancelled) return;
    window.scrollTo(x, y);
    const containersReached = Object.entries(scrollContainers).every(
      ([key, position]) => {
        const element = document.querySelector<HTMLElement>(
          `[data-history-scroll-key="${CSS.escape(key)}"]`,
        );
        if (!element) return false;
        element.scrollTo(position.x, position.y);
        return Math.abs(element.scrollTop - position.y) <= 1;
      },
    );
    const reached = Math.abs(window.scrollY - y) <= 1 && containersReached;
    if (reached || performance.now() - startedAt >= 2_000) {
      stop();
    }
  };

  observer = new MutationObserver(() => {
    window.requestAnimationFrame(attempt);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("pointerdown", stop, { passive: true });
  window.requestAnimationFrame(attempt);
  for (const delay of [50, 200, 600, 1_200, 2_000]) {
    timers.push(window.setTimeout(attempt, delay));
  }
  return stop;
}

function readPageState<T>(key: string, initialState: T | (() => T)): T {
  if (key.startsWith("global.") && globalStateCache.has(key)) {
    return globalStateCache.get(key) as T;
  }
  if (typeof window !== "undefined") {
    const pageState = objectState(window.history.state)[PAGE_STATE_KEY];
    if (
      pageState != null &&
      typeof pageState === "object" &&
      Object.prototype.hasOwnProperty.call(pageState, key)
    ) {
      const value = (pageState as Record<string, T>)[key];
      if (key.startsWith("global.")) globalStateCache.set(key, value);
      return value;
    }
  }
  return typeof initialState === "function"
    ? (initialState as () => T)()
    : initialState;
}

function writePageState<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  if (key.startsWith("global.")) globalStateCache.set(key, value);
  const state = objectState(window.history.state);
  const pageState = objectState(state[PAGE_STATE_KEY]);
  window.history.replaceState(
    {
      ...state,
      [PAGE_STATE_KEY]: {
        ...pageState,
        [key]: value,
      },
    },
    "",
  );
}

export function useHistoryEntryState<T>(
  key: string,
  initialState: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const initialValue = useRef<T>(readPageState(key, initialState));
  const [value, setValue] = useState<T>(initialValue.current);
  useEffect(() => {
    const syncFromHistory = (event: PopStateEvent) => {
      const pageState = objectState(event.state)[PAGE_STATE_KEY];
      if (key.startsWith("global.") && globalStateCache.has(key)) {
        const restored = globalStateCache.get(key) as T;
        setValue(restored);
        const currentPageState = objectState(window.history.state)[PAGE_STATE_KEY];
        if (
          currentPageState == null ||
          typeof currentPageState !== "object" ||
          !Object.prototype.hasOwnProperty.call(currentPageState, key) ||
          !Object.is((currentPageState as Record<string, T>)[key], restored)
        ) {
          writePageState(key, restored);
        }
        return;
      }
      if (
        pageState != null &&
        typeof pageState === "object" &&
        Object.prototype.hasOwnProperty.call(pageState, key)
      ) {
        const restored = (pageState as Record<string, T>)[key];
        if (key.startsWith("global.")) {
          globalStateCache.set(key, restored);
        }
        setValue(restored);
      } else if (key.startsWith("global.") && globalStateCache.has(key)) {
        setValue(globalStateCache.get(key) as T);
      } else {
        setValue(initialValue.current);
      }
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [key]);
  const setEntryValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      setValue((currentValue) => {
        const resolved =
          typeof nextValue === "function"
            ? (nextValue as (current: T) => T)(currentValue)
            : nextValue;
        writePageState(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, setEntryValue];
}

function canNavigateBackWithinApp() {
  if (typeof window === "undefined") return false;
  const tracker = (window as TrackedWindow)[TRACKER_KEY];
  return tracker != null &&
    hasSafeInternalPreviousEntry(window.history.state, tracker.sessionId);
}

type AppBackLinkProps = Omit<ComponentProps<"a">, "href"> & {
  fallbackHref: string;
};

export function AppBackLink({
  fallbackHref,
  onClick,
  target,
  download,
  ...props
}: AppBackLinkProps) {
  const [, setLocation] = useLocation();
  const href = appHref(fallbackHref);
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      download != null ||
      (target != null && target !== "_self")
    ) {
      return;
    }

    event.preventDefault();
    if (canNavigateBackWithinApp()) {
      saveCurrentScrollPosition();
      window.history.back();
    } else {
      setLocation(fallbackHref);
    }
  };

  return (
    <a
      {...props}
      href={href}
      target={target}
      download={download}
      onClick={handleClick}
    />
  );
}