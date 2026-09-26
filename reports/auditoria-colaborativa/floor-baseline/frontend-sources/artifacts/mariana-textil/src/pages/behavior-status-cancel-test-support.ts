import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRenderTestModule } from "../render-test-bundle";

type BehaviorPage = "list" | "detail" | "new";

type BehaviorFixture = {
  actor: Record<string, unknown>;
  salida: Record<string, unknown>;
};

/**
 * Builds an actual page with deterministic hook fixtures.  The badge alias is
 * an observing wrapper: it delegates to the production badge instead of
 * supplying a look-alike implementation.
 */
export async function loadBehaviorStatusCancelPage(
  page: BehaviorPage,
  fixture: BehaviorFixture,
) {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "behavior-status-cancel-"),
  );
  const apiStubPath = join(temporaryDirectory, "api-client-react.ts");
  const badgeSpyPath = join(temporaryDirectory, "badge-spy.tsx");
  const layoutStubPath = join(temporaryDirectory, "layout.tsx");
  const locationScopeStubPath = join(temporaryDirectory, "location-scope.ts");
  const navigationStubPath = join(temporaryDirectory, "navigation.tsx");
  const actualApiPath = new URL(
    "../../../../lib/api-client-react/src/index.ts",
    import.meta.url,
  ).pathname;
  const actualBadgePath = new URL(
    "../components/salida-estado-badge.tsx",
    import.meta.url,
  ).pathname;
  const pagePath = new URL(
    page === "list" ? "./salidas.tsx" : page === "new" ? "./salida-nueva.tsx" : "./salida-detail.tsx",
    import.meta.url,
  ).pathname;

  await Promise.all([
    writeFile(
      apiStubPath,
      `
        export * from ${JSON.stringify(actualApiPath)};
        const actor = ${JSON.stringify(fixture.actor)};
        const salida = ${JSON.stringify(fixture.salida)};
        const empty = { data: undefined, isLoading: false, error: null };
        export const useGetCurrentUser = () => ({ ...empty, data: actor });
        export const useListSalidas = () => ({
          ...empty,
          data: { items: [salida], total: 1, pageSize: 100 },
        });
        export const useGetSalida = () => ({ ...empty, data: salida });
        const draftData = { salida };
        export const useGetBorradorSalida = () => ({ ...empty, data: draftData, isSuccess: true });
        const mutation = { isPending: false, mutate() { throw new Error("Unexpected mutation"); }, mutateAsync() { throw new Error("Unexpected mutation"); } };
        export const useAgregarRolloBorradorSalida = () => mutation;
        export const useQuitarRolloBorradorSalida = () => mutation;
        export const useEnviarSalida = () => mutation;
        export const useGetUbicacionesSalida = () => ({ ...empty, data: [] });
        export const useListUsers = () => ({ ...empty, data: { items: [] } });
        export const useListProductos = () => ({ ...empty, data: { items: [] } });
      `,
      "utf8",
    ),
    writeFile(
      badgeSpyPath,
      `
        import React from "react";
        import { SalidaEstadoBadge as RealSalidaEstadoBadge } from ${JSON.stringify(actualBadgePath)};
        export * from ${JSON.stringify(actualBadgePath)};
        const observed = [];
        export function SalidaEstadoBadge(props) {
          observed.push(props);
          return React.createElement(
            "span",
            { "data-testid": "behavior-status-cancel-badge-spy" },
            React.createElement(RealSalidaEstadoBadge, props),
          );
        }
        export function takeObservedBadgeProps() {
          return observed.splice(0, observed.length);
        }
      `,
      "utf8",
    ),
    writeFile(
      layoutStubPath,
      `
        import React from "react";
        export function AppLayout({ children }) {
          return React.createElement("main", { "data-testid": "behavior-status-cancel-page-shell" }, children);
        }
      `,
      "utf8",
    ),
    writeFile(
      locationScopeStubPath,
      `
        export function useLocationScope() {
          return { selectedLocationId: null, setSelectedLocationId() {} };
        }
      `,
      "utf8",
    ),
    writeFile(
      navigationStubPath,
      `
        import React from "react";
        export function useHistoryEntryState(_key, initial) {
          return [typeof initial === "function" ? initial() : initial, () => {}];
        }
        export function AppBackLink({ fallbackHref, children, ...props }) {
          return React.createElement("a", { ...props, href: fallbackHref }, children);
        }
      `,
      "utf8",
    ),
  ]);

  try {
    return await loadRenderTestModule(
      `
        import Page from ${JSON.stringify(pagePath)};
        import { takeObservedBadgeProps } from "@/components/salida-estado-badge";
        export { Page, takeObservedBadgeProps };
      `,
      {
        moduleAliases: {
          "@workspace/api-client-react": apiStubPath,
          "@/components/salida-estado-badge": badgeSpyPath,
          "@/components/layout/app-layout": layoutStubPath,
          "@/lib/location-scope": locationScopeStubPath,
          "@/lib/internal-navigation": navigationStubPath,
        },
      },
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export function installBehaviorStatusCancelWindow(viewport: {
  width: number;
  height: number;
}) {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerWidth: viewport.width,
      innerHeight: viewport.height,
      location: { search: "" },
    },
  });
  return () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  };
}