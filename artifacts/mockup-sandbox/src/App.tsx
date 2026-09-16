import { useEffect, useState, type ComponentType } from "react";
import { modules as discoveredModules } from "./.generated/mockup-components";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function resolveComponent(mod: Record<string, unknown>, name: string): ComponentType | undefined {
  const functions = Object.values(mod).filter((value) => typeof value === "function") as ComponentType[];
  return (mod.default as ComponentType) || (mod[name] as ComponentType) || functions[functions.length - 1];
}

function PreviewRenderer({ componentPath, modules }: { componentPath: string; modules: ModuleMap }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = modules[`./components/mockups/${componentPath}.tsx`];
    if (!loader) {
      setError(`No component found at ${componentPath}.tsx`);
      return;
    }
    void loader()
      .then((mod) => {
        if (!cancelled) {
          const component = resolveComponent(mod, componentPath.split("/").at(-1) ?? "");
          if (component) setComponent(() => component);
          else setError(`No exported React component found in ${componentPath}.tsx`);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(`Failed to load preview.\n${String(loadError)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) return <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>{error}</pre>;
  return Component ? <Component /> : null;
}

function getPreviewPath(): string | null {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname;
  const local = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || "/" : pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

export default function App() {
  const previewPath = getPreviewPath();
  if (previewPath) return <PreviewRenderer componentPath={previewPath} modules={discoveredModules} />;
  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold">Component Preview Server</h1>
      <p className="mt-2 text-muted-foreground">Use a /preview/{`{folder}/{ComponentName}`} route.</p>
    </main>
  );
}