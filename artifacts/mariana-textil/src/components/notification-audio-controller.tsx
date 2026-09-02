import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getGetNotificationFeedQueryKey,
  NotificationFamily,
  Role,
  useGetNotificationFeed,
} from "@workspace/api-client-react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type QueueItem = {
  key: string;
  family: NotificationFamily;
};

type AudioState = "inactive" | "running" | "unavailable";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

const SOUND_FILES: Record<NotificationFamily, string> = {
  AVISO: "aviso.ogg",
  SOLICITUD: "solicitud.ogg",
  ALERTA: "alerta.ogg",
};
const MAX_SEEN_KEYS = 500;
const APP_SOUND_EVENT = "mariana:app-sound";

export function requestAppSound(family: NotificationFamily): void {
  window.dispatchEvent(
    new CustomEvent<NotificationFamily>(APP_SOUND_EVENT, { detail: family }),
  );
}

function eventKey(event: { id: string; updatedAt: string }): string {
  return `${event.id}:${event.updatedAt}`;
}

export function markKnownFeedAsSeen(
  seenKeys: ReadonlySet<string>,
  knownFeedKeys: ReadonlySet<string>,
): Set<string> {
  return new Set([...seenKeys, ...knownFeedKeys]);
}

export function unplayedFeedEvents<T extends {
  id: string;
  updatedAt: string;
}>(
  events: readonly T[],
  seenKeys: ReadonlySet<string>,
  queuedKeys: ReadonlySet<string>,
): T[] {
  return events.filter((event) => {
    const key = eventKey(event);
    return !seenKeys.has(key) && !queuedKeys.has(key);
  });
}

function readSeen(storageKey: string): Set<string> {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function persistSeen(storageKey: string, seen: Set<string>): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify([...seen].slice(-MAX_SEEN_KEYS)));
  } catch {
    // Audio remains usable when storage is unavailable; dedupe then lasts for this mount.
  }
}

export function NotificationAudioController({
  userId,
  role,
  navigationKey,
}: {
  userId: number;
  role: Role;
  navigationKey: string;
}) {
  const { toast } = useToast();
  const { data } = useGetNotificationFeed({
    query: {
      queryKey: getGetNotificationFeedQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const [audioState, setAudioState] = useState<AudioState>("inactive");
  const [activated, setActivated] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [headerTargets, setHeaderTargets] = useState<{
    mobile: HTMLElement | null;
    desktop: HTMLElement | null;
  }>({ mobile: null, desktop: null });
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackGenerationRef = useRef(0);
  const buffersRef = useRef(new Map<NotificationFamily, AudioBuffer>());
  const queueRef = useRef<QueueItem[]>([]);
  const queuedKeysRef = useRef(new Set<string>());
  const seenRef = useRef(new Set<string>());
  const feedKeysRef = useRef(new Set<string>());
  const baselineSessionRef = useRef<string | null>(null);
  const previousNavigationRef = useRef(navigationKey);
  const playingRef = useRef(false);
  const leaderRef = useRef(false);
  const activatedRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const sessionKey = data?.sessionKey;
  const seenStorageKey = sessionKey
    ? `mariana:notification-audio:seen:${userId}:${sessionKey}`
    : null;

  const markPlayed = useCallback((key: string) => {
    if (!seenStorageKey) return;
    seenRef.current.add(key);
    persistSeen(seenStorageKey, seenRef.current);
    channelRef.current?.postMessage({ type: "played", key });
  }, [seenStorageKey]);

  const loadSound = useCallback(async (family: NotificationFamily): Promise<AudioBuffer> => {
    const cached = buffersRef.current.get(family);
    if (cached) return cached;
    const context = audioContextRef.current;
    if (!context) throw new Error("El audio todavía no está activo.");
    const response = await fetch(`${import.meta.env.BASE_URL}sounds/${SOUND_FILES[family]}`, {
      cache: "force-cache",
    });
    if (!response.ok) throw new Error(`No se pudo cargar el sonido ${family}.`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    buffersRef.current.set(family, buffer);
    return buffer;
  }, []);

  const playFamily = useCallback(async (
    family: NotificationFamily,
    generation: number,
  ): Promise<boolean> => {
    const context = audioContextRef.current;
    if (!context || context.state !== "running") {
      setAudioState(context?.state === "closed" ? "unavailable" : "inactive");
      throw new Error("El navegador suspendió el audio.");
    }
    const source = context.createBufferSource();
    source.buffer = await loadSound(family);
    if (playbackGenerationRef.current !== generation) return false;
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
        if (activeSourceRef.current === source) activeSourceRef.current = null;
        reject(error);
      }
    });
    return playbackGenerationRef.current === generation;
  }, [loadSound]);

  const drainQueue = useCallback(async () => {
    if (playingRef.current || !leaderRef.current || audioContextRef.current?.state !== "running") return;
    playingRef.current = true;
    try {
      while (queueRef.current.length && leaderRef.current && audioContextRef.current?.state === "running") {
        const item = queueRef.current[0]!;
        const generation = playbackGenerationRef.current;
        try {
          const completed = await playFamily(item.family, generation);
          if (!completed || playbackGenerationRef.current !== generation) break;
          markPlayed(item.key);
          queueRef.current.shift();
          queuedKeysRef.current.delete(item.key);
        } catch {
          setAudioState("inactive");
          break;
        }
      }
    } finally {
      playingRef.current = false;
    }
  }, [markPlayed, playFamily]);

  useEffect(() => {
    activatedRef.current = activated;
  }, [activated]);

  useEffect(() => {
    leaderRef.current = isLeader;
    if (isLeader) void drainQueue();
  }, [drainQueue, isLeader]);

  useEffect(() => {
    const handleAppSound = (event: Event) => {
      if (!leaderRef.current || audioContextRef.current?.state !== "running") {
        return;
      }
      const family = (event as CustomEvent<NotificationFamily>).detail;
      if (typeof family !== "string" || !(family in SOUND_FILES)) return;
      const key = `local:${crypto.randomUUID()}`;
      queueRef.current.push({ key, family });
      queuedKeysRef.current.add(key);
      void drainQueue();
    };
    window.addEventListener(APP_SOUND_EVENT, handleAppSound);
    return () => window.removeEventListener(APP_SOUND_EVENT, handleAppSound);
  }, [drainQueue]);

  useEffect(() => {
    if (!sessionKey || !seenStorageKey) return;
    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(`mariana-notification-audio:${userId}:${sessionKey}`);
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = (message: MessageEvent<{ type?: string; key?: string }>) => {
        if (message.data?.type !== "played" || !message.data.key) return;
        seenRef.current.add(message.data.key);
        persistSeen(seenStorageKey, seenRef.current);
        queuedKeysRef.current.delete(message.data.key);
        queueRef.current = queueRef.current.filter((item) => item.key !== message.data.key);
      };
    }
    return () => {
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [seenStorageKey, sessionKey, userId]);

  useEffect(() => {
    setHeaderTargets({
      mobile: document.getElementById("notification-audio-mobile-slot"),
      desktop: document.getElementById("notification-audio-desktop-slot"),
    });
  }, []);

  useEffect(() => {
    if (!sessionKey || !activated) {
      setIsLeader(false);
      return;
    }
    const lockManager = navigator.locks;
    if (!lockManager) {
      // Fail closed: without an exclusive cross-tab primitive, silence is safer
      // than allowing two tabs to emit the same notification.
      setIsLeader(false);
      return;
    }
    let cancelled = false;
    let release: (() => void) | null = null;
    void lockManager.request(
      `mariana-notification-audio:${userId}:${sessionKey}`,
      { mode: "exclusive" },
      async () => {
        if (cancelled) return;
        setIsLeader(true);
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        setIsLeader(false);
      },
    );
    return () => {
      cancelled = true;
      release?.();
      setIsLeader(false);
    };
  }, [activated, sessionKey, userId]);

  useEffect(() => {
    if (previousNavigationRef.current === navigationKey) return;
    previousNavigationRef.current = navigationKey;
    playbackGenerationRef.current += 1;
    try {
      activeSourceRef.current?.stop();
    } catch {
      // The source may have ended between the reference check and stop().
    }
    activeSourceRef.current = null;
    queueRef.current = [];
    queuedKeysRef.current.clear();
    if (!seenStorageKey) return;
    seenRef.current = markKnownFeedAsSeen(
      seenRef.current,
      feedKeysRef.current,
    );
    persistSeen(seenStorageKey, seenRef.current);
  }, [navigationKey, seenStorageKey]);

  useEffect(() => {
    if (!sessionKey || !seenStorageKey || !data) return;
    if (baselineSessionRef.current !== sessionKey) {
      seenRef.current = readSeen(seenStorageKey);
      for (const event of data.events) seenRef.current.add(eventKey(event));
      persistSeen(seenStorageKey, seenRef.current);
      baselineSessionRef.current = sessionKey;
      feedKeysRef.current = new Set(data.events.map(eventKey));
      return;
    }
    const candidates = isLeader
      ? unplayedFeedEvents(data.events, seenRef.current, queuedKeysRef.current)
      : [];
    for (const event of candidates) {
      const key = eventKey(event);
      queuedKeysRef.current.add(key);
      queueRef.current.push({ key, family: event.family });
    }
    feedKeysRef.current = new Set(data.events.map(eventKey));
    if (!isLeader) return;
    void drainQueue();
  }, [data, drainQueue, isLeader, seenStorageKey, sessionKey]);

  useEffect(() => {
    if (role !== Role.CAJA) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || sentinel) return;
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      }).wakeLock;
      if (!wakeLock) return;
      try {
        const acquired = await wakeLock.request("screen");
        if (cancelled) {
          await acquired.release();
          return;
        }
        sentinel = acquired;
        acquired.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // Browsers may reject Wake Lock in background or battery-saving modes.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release();
    };
  }, [role]);

  useEffect(() => () => {
    playbackGenerationRef.current += 1;
    try {
      activeSourceRef.current?.stop();
    } catch {
      // The source may already be stopped.
    }
    activeSourceRef.current = null;
    queueRef.current = [];
    queuedKeysRef.current.clear();
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const activateAudio = async () => {
    try {
      const AudioContextConstructor = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        setAudioState("unavailable");
        throw new Error("Este navegador no ofrece audio de notificaciones.");
      }
      let context = audioContextRef.current;
      if (!context || context.state === "closed") {
        context = new AudioContextConstructor();
        audioContextRef.current = context;
        context.onstatechange = () => {
          const running = context?.state === "running";
          setAudioState(running ? "running" : "inactive");
          if (!running) setActivated(false);
        };
      }
      await context.resume();
      if (context.state !== "running") throw new Error("El navegador mantuvo el audio suspendido.");
      setActivated(true);
      setAudioState("running");
      if (data?.sessionKey) {
        sessionStorage.setItem(
          `mariana:notification-audio:activated:${data.sessionKey}`,
          "1",
        );
      }
      await playFamily(
        NotificationFamily.AVISO,
        playbackGenerationRef.current,
      );
      toast({ title: "Sonido activado", description: "Las nuevas notificaciones usarán audio local." });
      void drainQueue();
    } catch (error) {
      setActivated(false);
      setAudioState("inactive");
      toast({
        title: "No se pudo activar el sonido",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (
      data?.sessionKey &&
      !activated &&
      sessionStorage.getItem(
        `mariana:notification-audio:activated:${data.sessionKey}`,
      ) === "1"
    ) {
      void activateAudio();
    }
  }, [activated, data?.sessionKey]);

  if (audioState === "running") return null;

  const activationButton = (mobile: boolean) => (
      <Button
        type="button"
        onClick={activateAudio}
        className={mobile ? "text-white hover:bg-sidebar-accent" : "gap-2"}
        size={mobile ? "icon" : "sm"}
        variant={mobile ? "ghost" : audioState === "unavailable" ? "destructive" : "outline"}
        data-testid="button-enable-notification-sound"
      >
        {audioState === "unavailable" ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {mobile ? <span className="sr-only">Activar sonido</span> : "Activar sonido"}
      </Button>
  );

  return (
    <>
      {headerTargets.mobile && createPortal(activationButton(true), headerTargets.mobile)}
      {headerTargets.desktop && createPortal(activationButton(false), headerTargets.desktop)}
    </>
  );
}