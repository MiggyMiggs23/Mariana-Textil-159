import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  getGetNotificationFeedQueryKey,
  NotificationFamily,
  Role,
  useGetNotificationFeed,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export type SoundFamily = NotificationFamily | "PAGO";

type QueueItem = { key: string; family: SoundFamily };
type AudioControls = {
  enabled: boolean;
  status: "off" | "ready" | "blocked" | "unavailable";
  setEnabled: (value: boolean) => void;
};

const AudioControlsContext = createContext<AudioControls | null>(null);
const SOUND_FILES: Record<SoundFamily, string> = {
  AVISO: "aviso.ogg", // New ordinary bell notification
  SOLICITUD: "aviso.ogg", // New request in the bell
  ALERTA: "alerta.ogg", // New alert
  PAGO: "solicitud.ogg", // Successfully registered payment
};
const APP_SOUND_EVENT = "mariana:app-sound";
const MAX_SEEN_KEYS = 500;

export function requestAppSound(family: SoundFamily, eventId?: string): void {
  window.dispatchEvent(new CustomEvent<{ family: SoundFamily; eventId?: string }>(APP_SOUND_EVENT, {
    detail: { family, eventId },
  }));
}

export function useNotificationAudio(): AudioControls {
  const controls = useContext(AudioControlsContext);
  if (!controls) throw new Error("El control de audio requiere una sesión activa.");
  return controls;
}

// Feed IDs represent occurrences. updatedAt changes (including marking read) are not new events.
function eventKey(event: { id: string }): string {
  return event.id;
}

export function markKnownFeedAsSeen(
  seenKeys: ReadonlySet<string>,
  knownFeedKeys: ReadonlySet<string>,
): Set<string> {
  return new Set([...seenKeys, ...knownFeedKeys]);
}

export function unplayedFeedEvents<T extends { id: string }>(
  events: readonly T[],
  seenKeys: ReadonlySet<string>,
  queuedKeys: ReadonlySet<string>,
): T[] {
  return events.filter(event => !seenKeys.has(eventKey(event)) && !queuedKeys.has(eventKey(event)));
}

function readSeen(storageKey: string): Set<string> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function persistSeen(storageKey: string, seen: Set<string>): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify([...seen].slice(-MAX_SEEN_KEYS)));
  } catch {
    // In-memory deduplication still works when session storage is unavailable.
  }
}

function readPreference(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

export function NotificationAudioController({
  userId,
  role,
  children,
}: {
  userId: number;
  role: Role;
  children?: ReactNode;
}) {
  const { toast } = useToast();
  const { data, isFetching, isFetchedAfterMount } = useGetNotificationFeed({
    query: {
      queryKey: getGetNotificationFeedQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const preferenceKey = `mariana:notification-audio:enabled:${userId}`;
  const [enabled, setEnabledState] = useState(() => readPreference(preferenceKey));
  const [status, setStatus] = useState<AudioControls["status"]>("off");
  const [baselined, setBaselined] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const generationRef = useRef(0);
  const buffersRef = useRef(new Map<SoundFamily, AudioBuffer>());
  const queueRef = useRef<QueueItem[]>([]);
  const queuedKeysRef = useRef(new Set<string>());
  const seenRef = useRef(new Set<string>());
  const feedKeysRef = useRef(new Set<string>());
  const baselineSessionRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const leaderRef = useRef(false);
  const enabledRef = useRef(enabled);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const autoAttemptedRef = useRef(false);
  const sessionKey = data?.sessionKey;
  const seenStorageKey = sessionKey ? `mariana:notification-audio:seen:${userId}:${sessionKey}` : null;

  const clearPlayback = useCallback(() => {
    generationRef.current += 1;
    try {
      activeSourceRef.current?.stop();
    } catch {
      // Source may already have ended.
    }
    activeSourceRef.current = null;
    queueRef.current = [];
    queuedKeysRef.current.clear();
  }, []);

  const markPlayed = useCallback((key: string) => {
    if (!seenStorageKey) return;
    seenRef.current.add(key);
    persistSeen(seenStorageKey, seenRef.current);
    channelRef.current?.postMessage({ type: "played", key });
  }, [seenStorageKey]);

  const loadSound = useCallback(async (family: SoundFamily) => {
    const cached = buffersRef.current.get(family);
    if (cached) return cached;
    const context = contextRef.current;
    if (!context) throw new Error("El audio todavía no está activo.");
    const response = await fetch(`${import.meta.env.BASE_URL}sounds/${SOUND_FILES[family]}`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`No se pudo cargar el sonido ${family}.`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    buffersRef.current.set(family, buffer);
    return buffer;
  }, []);

  const playFamily = useCallback(async (family: SoundFamily, generation: number): Promise<boolean> => {
    const context = contextRef.current;
    if (!context || context.state !== "running") throw new Error("El navegador suspendió el audio.");
    const buffer = await loadSound(family);
    if (generationRef.current !== generation || !leaderRef.current || !enabledRef.current) return false;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    activeSourceRef.current = source;
    await new Promise<void>((resolve, reject) => {
      source.addEventListener("ended", () => {
        if (activeSourceRef.current === source) activeSourceRef.current = null;
        resolve();
      }, { once: true });
      try {
        source.start();
      } catch (error) {
        activeSourceRef.current = null;
        reject(error);
      }
    });
    return generationRef.current === generation;
  }, [loadSound]);

  const drainQueue = useCallback(async (): Promise<void> => {
    if (playingRef.current || !leaderRef.current || !enabledRef.current || contextRef.current?.state !== "running") return;
    playingRef.current = true;
    try {
      while (queueRef.current.length && leaderRef.current && enabledRef.current && contextRef.current?.state === "running") {
        const item = queueRef.current[0]!;
        const generation = generationRef.current;
        try {
          const completed = await playFamily(item.family, generation);
          if (!completed) break;
          if (!item.key.startsWith("transient:")) markPlayed(item.key);
          queueRef.current.shift();
          queuedKeysRef.current.delete(item.key);
        } catch {
          clearPlayback(); // Never play a backlog after a browser audio block.
          setStatus("blocked");
          break;
        }
      }
    } finally {
      playingRef.current = false;
      // A new event may have arrived while the old (now cancelled) drain was finishing.
      if (queueRef.current.length && leaderRef.current && enabledRef.current && contextRef.current?.state === "running") {
        void drainQueue();
      }
    }
  }, [clearPlayback, markPlayed, playFamily]);

  const silence = useCallback(() => {
    enabledRef.current = false;
    leaderRef.current = false;
    clearPlayback();
    const context = contextRef.current;
    contextRef.current = null;
    if (context) void context.close().catch(() => {});
    buffersRef.current.clear();
    setStatus("off");
  }, [clearPlayback]);

  const setEnabled = useCallback((value: boolean) => {
    try {
      localStorage.setItem(preferenceKey, value ? "1" : "0");
    } catch {
      // Preference remains effective for this tab.
    }
    if (!value) {
      autoAttemptedRef.current = false;
      silence();
      if (seenStorageKey) {
        seenRef.current = markKnownFeedAsSeen(seenRef.current, feedKeysRef.current);
        persistSeen(seenStorageKey, seenRef.current);
      }
    } else {
      // Turning on never replays an off-period backlog.
      enabledRef.current = true;
      if (seenStorageKey) {
        seenRef.current = markKnownFeedAsSeen(seenRef.current, feedKeysRef.current);
        persistSeen(seenStorageKey, seenRef.current);
      }
    }
    setEnabledState(value);
  }, [preferenceKey, seenStorageKey, silence]);

  const activateAudio = useCallback(async (fromGesture: boolean) => {
    if (!enabledRef.current || !baselineSessionRef.current) return;
    const generation = generationRef.current;
    try {
      const AudioContextConstructor = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        setStatus("unavailable");
        if (fromGesture) toast({ title: "No se pudo activar el sonido", description: "Este navegador no ofrece audio de notificaciones.", variant: "destructive" });
        return;
      }
      let context = contextRef.current;
      if (!context || context.state === "closed") {
        context = new AudioContextConstructor();
        contextRef.current = context;
        const activeContext = context;
        activeContext.onstatechange = () => {
          if (contextRef.current !== activeContext) return;
          setStatus(activeContext.state === "running" ? "ready" : "blocked");
        };
      }
      await context.resume();
      if (generationRef.current !== generation || !enabledRef.current) return;
      if (context.state !== "running") throw new Error("El navegador mantuvo el audio suspendido.");
      setStatus("ready");
      // Activation is silent. Only a subsequent real event can enqueue a sound.
      void drainQueue();
    } catch (error) {
      if (generationRef.current !== generation || !enabledRef.current) return;
      setStatus("blocked");
      if (fromGesture) toast({
        title: "No se pudo activar el sonido",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [drainQueue, toast]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== preferenceKey) return;
      const next = event.newValue === "1";
      if (!next) silence();
      else {
        enabledRef.current = true;
        if (seenStorageKey) {
          seenRef.current = markKnownFeedAsSeen(seenRef.current, feedKeysRef.current);
          persistSeen(seenStorageKey, seenRef.current);
        }
        autoAttemptedRef.current = false;
      }
      setEnabledState(next);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [preferenceKey, seenStorageKey, silence]);

  useEffect(() => {
    if (!data || isFetching || !isFetchedAfterMount) return;
    if (baselineSessionRef.current !== data.sessionKey) {
      clearPlayback();
      baselineSessionRef.current = data.sessionKey;
      seenRef.current = readSeen(`mariana:notification-audio:seen:${userId}:${data.sessionKey}`);
      // Initial successful NETWORK snapshot, not a cached query, is the silent baseline.
      for (const event of data.events) seenRef.current.add(eventKey(event));
      persistSeen(`mariana:notification-audio:seen:${userId}:${data.sessionKey}`, seenRef.current);
      feedKeysRef.current = new Set(data.events.map(eventKey));
      setBaselined(true);
      return;
    }
    const candidates = unplayedFeedEvents(data.events, seenRef.current, queuedKeysRef.current);
    for (const event of candidates) {
      const key = eventKey(event);
      // Account for new events even while off/nonleader; no backlog on enable/leadership.
      seenRef.current.add(key);
      if (enabledRef.current && contextRef.current?.state === "running") {
        queuedKeysRef.current.add(key);
        queueRef.current.push({ key, family: event.family });
      }
    }
    if (seenStorageKey) persistSeen(seenStorageKey, seenRef.current);
    feedKeysRef.current = new Set(data.events.map(eventKey));
    void drainQueue();
  }, [data, isFetching, isFetchedAfterMount, userId, seenStorageKey, clearPlayback, drainQueue]);

  useEffect(() => {
    if (!baselined || !enabled || autoAttemptedRef.current) return;
    autoAttemptedRef.current = true;
    void activateAudio(false);
  }, [baselined, enabled, activateAudio]);

  useEffect(() => {
    if (!sessionKey || !baselined) return;
    const channel = typeof BroadcastChannel === "undefined" ? null
      : new BroadcastChannel(`mariana-notification-audio:${userId}:${sessionKey}`);
    channelRef.current = channel;
    if (channel) channel.onmessage = (message: MessageEvent<{ type?: string; key?: string }>) => {
      if (!message.data?.key) return;
      if (message.data.type === "payment") {
        if (!message.data.key.startsWith("local:") || !leaderRef.current || !enabledRef.current
          || contextRef.current?.state !== "running" || seenRef.current.has(message.data.key)
          || queuedKeysRef.current.has(message.data.key)) return;
        queueRef.current.push({ key: message.data.key, family: "PAGO" });
        queuedKeysRef.current.add(message.data.key);
        void drainQueue();
        return;
      }
      if (message.data.type !== "played") return;
      seenRef.current.add(message.data.key);
      if (seenStorageKey) persistSeen(seenStorageKey, seenRef.current);
      queuedKeysRef.current.delete(message.data.key);
      queueRef.current = queueRef.current.filter(item => item.key !== message.data.key);
    };
    return () => {
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [baselined, seenStorageKey, sessionKey, userId, drainQueue]);

  useEffect(() => {
    if (!sessionKey || !baselined || !enabled) return;
    const lockManager = navigator.locks;
    if (!lockManager) {
      // Fail closed: BroadcastChannel alone cannot provide true exclusion.
      return;
    }
    let cancelled = false;
    let release: (() => void) | undefined;
    void lockManager.request(`mariana-notification-audio:${userId}:${sessionKey}`, { mode: "exclusive" }, async () => {
      if (cancelled) return;
      leaderRef.current = true;
      void drainQueue();
      await new Promise<void>(resolve => { release = resolve; });
      leaderRef.current = false;
      clearPlayback();
    }).catch(() => {
      leaderRef.current = false;
      clearPlayback();
    });
    return () => {
      cancelled = true;
      leaderRef.current = false;
      clearPlayback();
      release?.();
    };
  }, [sessionKey, userId, baselined, enabled, clearPlayback, drainQueue]);

  useEffect(() => {
    const handleAppSound = (event: Event) => {
      if (!enabledRef.current || !baselineSessionRef.current) return;
      const { family, eventId } = (event as CustomEvent<{ family: SoundFamily; eventId?: string }>).detail ?? {};
      // The only operational local sound is a successfully registered payment.
      if (family !== "PAGO") return;
      const key = eventId ? `local:${eventId}` : `transient:${crypto.randomUUID()}`;
      if (seenRef.current.has(key) || queuedKeysRef.current.has(key)) return;
      if (!leaderRef.current) {
        // Successful payments happen in the originating tab, not necessarily
        // the tab holding the exclusive audio lock. Forward their stable ID.
        if (eventId) channelRef.current?.postMessage({ type: "payment", key });
        return;
      }
      if (contextRef.current?.state !== "running") return;
      queueRef.current.push({ key, family });
      queuedKeysRef.current.add(key);
      void drainQueue();
    };
    window.addEventListener(APP_SOUND_EVENT, handleAppSound);
    return () => window.removeEventListener(APP_SOUND_EVENT, handleAppSound);
  }, [drainQueue, seenStorageKey]);

  useEffect(() => {
    if (role !== Role.CAJA) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || sentinel) return;
      const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (!wakeLock) return;
      try {
        const acquired = await wakeLock.request("screen");
        if (cancelled) { await acquired.release(); return; }
        sentinel = acquired;
        acquired.addEventListener("release", () => { sentinel = null; });
      } catch {
        // Battery-saving and background policies can refuse a screen wake lock.
      }
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release();
    };
  }, [role]);

  useEffect(() => () => {
    silence();
    seenRef.current.clear();
    feedKeysRef.current.clear();
    buffersRef.current.clear();
  }, [silence]);

  return (
    <AudioControlsContext.Provider value={{
      enabled,
      status,
      setEnabled: value => {
        setEnabled(value);
        if (value && baselineSessionRef.current) {
          autoAttemptedRef.current = true;
          void activateAudio(true);
        }
      },
    }}>
      {children}
    </AudioControlsContext.Provider>
  );
}