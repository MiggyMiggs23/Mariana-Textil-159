import { useCallback, useEffect, useRef, useState } from "react";
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
const LEADER_LEASE_MS = 7_000;
const MAX_SEEN_KEYS = 500;

function eventKey(event: { id: string; updatedAt: string }): string {
  return `${event.id}:${event.updatedAt}`;
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
}: {
  userId: number;
  role: Role;
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef(new Map<NotificationFamily, AudioBuffer>());
  const queueRef = useRef<QueueItem[]>([]);
  const queuedKeysRef = useRef(new Set<string>());
  const seenRef = useRef(new Set<string>());
  const baselineSessionRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const leaderRef = useRef(false);
  const activatedRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef(
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  const sessionKey = data?.sessionKey;
  const seenStorageKey = sessionKey
    ? `mariana:notification-audio:seen:${userId}:${sessionKey}`
    : null;
  const leaderStorageKey = sessionKey
    ? `mariana:notification-audio:leader:${userId}:${sessionKey}`
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

  const playFamily = useCallback(async (family: NotificationFamily): Promise<void> => {
    const context = audioContextRef.current;
    if (!context || context.state !== "running") {
      setAudioState(context?.state === "closed" ? "unavailable" : "inactive");
      throw new Error("El navegador suspendió el audio.");
    }
    const source = context.createBufferSource();
    source.buffer = await loadSound(family);
    source.connect(context.destination);
    await new Promise<void>((resolve, reject) => {
      source.addEventListener("ended", () => resolve(), { once: true });
      try {
        source.start();
      } catch (error) {
        reject(error);
      }
    });
  }, [loadSound]);

  const drainQueue = useCallback(async () => {
    if (playingRef.current || !leaderRef.current || audioContextRef.current?.state !== "running") return;
    playingRef.current = true;
    try {
      while (queueRef.current.length && leaderRef.current && audioContextRef.current?.state === "running") {
        const item = queueRef.current[0]!;
        try {
          await playFamily(item.family);
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
    if (!leaderStorageKey || !sessionKey || !activated) {
      setIsLeader(false);
      return;
    }
    const claim = () => {
      try {
        const now = Date.now();
        const raw = localStorage.getItem(leaderStorageKey);
        const current = raw ? JSON.parse(raw) as { tabId?: string; expiresAt?: number } : null;
        if (!current?.tabId || !current.expiresAt || current.expiresAt <= now || current.tabId === tabIdRef.current) {
          localStorage.setItem(leaderStorageKey, JSON.stringify({
            tabId: tabIdRef.current,
            expiresAt: now + LEADER_LEASE_MS,
          }));
          setIsLeader(true);
          return;
        }
        setIsLeader(false);
      } catch {
        setIsLeader(true);
      }
    };
    claim();
    const interval = window.setInterval(claim, 2_000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === leaderStorageKey) claim();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      try {
        const current = JSON.parse(localStorage.getItem(leaderStorageKey) ?? "{}") as { tabId?: string };
        if (current.tabId === tabIdRef.current) localStorage.removeItem(leaderStorageKey);
      } catch {
        // Ignore unavailable storage during cleanup.
      }
      setIsLeader(false);
    };
  }, [activated, leaderStorageKey, sessionKey]);

  useEffect(() => {
    if (!sessionKey || !seenStorageKey || !data) return;
    if (baselineSessionRef.current !== sessionKey) {
      seenRef.current = readSeen(seenStorageKey);
      for (const event of data.events) seenRef.current.add(eventKey(event));
      persistSeen(seenStorageKey, seenRef.current);
      baselineSessionRef.current = sessionKey;
      return;
    }
    if (!isLeader) return;
    for (const event of data.events) {
      const key = eventKey(event);
      if (seenRef.current.has(key) || queuedKeysRef.current.has(key)) continue;
      queuedKeysRef.current.add(key);
      queueRef.current.push({ key, family: event.family });
    }
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
      await playFamily(NotificationFamily.AVISO);
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

  if (audioState === "running") return null;

  return (
    <div className="no-print fixed bottom-4 right-4 z-[70]">
      <Button
        type="button"
        onClick={activateAudio}
        className="gap-2 shadow-lg"
        variant={audioState === "unavailable" ? "destructive" : "default"}
        data-testid="button-enable-notification-sound"
      >
        {audioState === "unavailable" ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        Activar sonido
      </Button>
    </div>
  );
}