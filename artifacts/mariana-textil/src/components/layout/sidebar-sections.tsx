import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TITLES = [
  "INVENTARIO", "OPERACIÓN", "CAJA", "DIRECTORIO",
  "CONFIGURACIÓN",
] as const;
type Preferences = Record<string, boolean>;
const storageKey = (userId: number) => `mariana:sidebar-sections:v1:${userId}`;

export function readSidebarPreferences(userId: number): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(TITLES.flatMap(title => {
      const open = (value as Preferences)[title];
      return typeof open === "boolean" ? [[title, open]] : [];
    }));
  } catch {
    return {};
  }
}

export function useSidebarSections(userId: number | undefined, location: string) {
  const { toast } = useToast();
  const initial = useMemo(() => userId == null ? {} : readSidebarPreferences(userId), [userId]);
  const [state, setState] = useState<{
    userId: number | undefined;
    preferences: Preferences;
    location: string;
    overrides: Preferences;
  }>({ userId, preferences: initial, location, overrides: {} });
  // Never expose the previous actor's state, even for the first render after login.
  const preferences = state.userId === userId ? state.preferences : initial;
  const overrides = state.userId === userId && state.location === location ? state.overrides : {};

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (userId != null && (event.key === storageKey(userId) || event.key === null)) {
        setState({ userId, preferences: readSidebarPreferences(userId), location, overrides: {} });
      }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, [userId, location]);

  const isOpen = (title: string, active: boolean) =>
    overrides[title] ?? (active || preferences[title] !== false);
  const toggle = (title: string, active: boolean) => {
    if (userId == null) return;
    const open = !isOpen(title, active);
    const next = { ...readSidebarPreferences(userId), ...preferences, [title]: open };
    setState({ userId, preferences: next, location, overrides: { ...overrides, [title]: open } });
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      toast({
        title: "No se pudo guardar la preferencia del menú",
        description: "El navegador bloqueó el almacenamiento. El cambio solo se conservará mientras esta pantalla permanezca abierta.",
        variant: "destructive",
      });
    }
  };
  return { isOpen, toggle };
}

export function SidebarSection({
  title, active, sections, children, testId,
}: {
  title?: string;
  active: boolean;
  sections: ReturnType<typeof useSidebarSections>;
  children: ReactNode;
  testId?: string;
}) {
  const id = useId();
  const collapsible = TITLES.some(item => item === title);
  const open = !title || !collapsible || sections.isOpen(title, active);
  const Arrow = open ? ChevronDown : ChevronRight;
  return (
    <div className="px-3 space-y-1" data-testid={testId}>
      {title && (collapsible ? (
        <h4 className="mb-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => sections.toggle(title, active)}
            className="flex w-full items-center justify-between gap-1 rounded-sm px-3 text-left text-xs font-semibold text-sidebar-foreground/50 tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <span>{title}</span>
            <Arrow className="h-3 w-3 shrink-0" aria-hidden="true" />
          </button>
        </h4>
      ) : (
        <h4 className="px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider mb-2">{title}</h4>
      ))}
      <div id={id} hidden={!open} className="space-y-1">{children}</div>
    </div>
  );
}
