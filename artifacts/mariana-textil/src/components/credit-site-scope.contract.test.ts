import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { creditStores } from "./credit-site-scope";
import { LocationType, type Location } from "@workspace/api-client-react";
import { visibleCreditTicketId } from "../lib/credit-folio-scope";
import { resolveReportViewMode } from "./reportes/report-scope";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("credit selectors use site type, never name or merely active status", () => {
  const selector = read("./credit-site-scope.tsx");
  const cartera = read("../pages/clientes.tsx");
  assert.match(selector, /locations\.filter\(\(site\) => site\.tipo === LocationType\.TIENDA\)/);
  assert.match(cartera, /locations\.filter\(\(location\) => location\.tipo === LocationType\.TIENDA\)/);
  assert.doesNotMatch(selector, /nombre\.includes|nombre\.startsWith|activa === true/);
  assert.doesNotMatch(cartera, /nombre\.includes|nombre\.startsWith|activa === true/);
  assert.match(cartera, /!invalidCarteraSelection/);
  assert.match(cartera, /carteraReady = Boolean\(authReady && !invalidCarteraSelection/);
  assert.match(cartera, /const \[carteraLocationIds, setCarteraLocationIds\] = useState<number\[\]>\(\[\]\)/);
  assert.doesNotMatch(cartera, /useLocationScope|headerSiteId/);
});

test("reactivated Bodega Cruces remains excluded until its type changes to store", () => {
  const bodega = { id: 7, nombre: "Bodega Cruces", tipo: LocationType.BODEGA, activa: true } as Location;
  const inactiveStore = { id: 8, nombre: "Tienda anterior", tipo: LocationType.TIENDA, activa: false } as Location;
  assert.deepEqual(creditStores([bodega, inactiveStore]).map((site) => site.id), [8]);
  // Active-only is independently enforced by the location catalog endpoint;
  // changing the type, without renaming the site, makes it eligible here.
  assert.deepEqual(creditStores([{ ...bodega, tipo: LocationType.TIENDA }]).map((site) => site.id), [7]);
});

test("warehouse selection blocks credit readers rather than becoming global", () => {
  const selector = read("./credit-site-scope.tsx");
  const reports = read("../pages/reportes.tsx");
  const e7 = read("./e7-readers.tsx");
  assert.match(selector, /value: headerSiteId/);
  assert.match(selector, /choice\.header === headerSiteId \? choice\.value : headerSiteId/);
  assert.match(selector, /!stores\.some\(\(site\) => site\.id === selectedSiteId\)/);
  assert.match(selector, /value === "global" \? null : Number\(value\)/);
  assert.match(reports, /selectedLocationId: credit\.selectedSiteId/);
  assert.match(reports, /!credit\.ready/);
  assert.match(e7, /credit\.error \? <p role="alert"/);
  assert.match(e7, /credit\.selectedSiteId/);
  const cobros = read("../pages/cobros.tsx");
  assert.match(cobros, /useCreditSiteScope\(true\)/);
  assert.match(cobros, /ubicacionId: credit\.selectedSiteId/);
  assert.match(cobros, /enabled: !!searchFolio && credit\.ready && folioSearchSiteId === credit\.selectedSiteId/);
  assert.match(cobros, /enabled: !!clienteId && canViewFinances,/);
});

test("credit comparison follows contextual Global, not operational Bodega selection", () => {
  const reports = read("../pages/reportes.tsx");
  assert.match(reports, /const reportSiteId = activeTab === "clientes" \? credit\.selectedSiteId : selectedLocationId/);
  assert.match(reports, /const effectiveViewMode = viewMode/);
  assert.match(reports, /value=\{viewMode\}/);
  assert.equal(resolveReportViewMode("comparar", null, "TODAS", "ADMIN"), "comparar");
  assert.equal(resolveReportViewMode("comparar", 7, "TODAS", "ADMIN"), "normal");
  assert.equal(resolveReportViewMode("comparar", null, "PROPIA", "ADMIN"), "normal");
});

test("switching store hides old folio ticket immediately but preserves QR identity", () => {
  assert.equal(visibleCreditTicketId(42, 7, 8), null);
  assert.equal(visibleCreditTicketId(42, 7, null), null);
  assert.equal(visibleCreditTicketId(42, 7, 7), 42);
  assert.equal(visibleCreditTicketId(42, undefined, 8), 42);
  assert.equal(visibleCreditTicketId(42, undefined, null), 42);
  const cobros = read("../pages/cobros.tsx");
  assert.match(cobros, /setSearchFolio\(null\)/);
  assert.match(cobros, /setResolvedTicketId\(null\)/);
  assert.match(cobros, /setFolioResolvedSiteId\(credit\.selectedSiteId\)/);
  assert.match(cobros, /setFolioResolvedSiteId\(undefined\)/);
  assert.match(cobros, /useObtenerTicket\(visibleTicketId \|\| 0/);
});

test("operational header and provider stay independent, report filters remain present", () => {
  const selector = read("./credit-site-scope.tsx");
  const reports = read("../pages/reportes.tsx");
  const header = read("./layout/app-layout.tsx");
  const provider = read("../lib/location-scope.tsx");
  assert.doesNotMatch(selector, /setSelectedLocationId/);
  assert.match(header, /getGetUbicacionesInventarioQueryKey\(\)/);
  assert.match(header, /locations\?\.map\(\(item\)/);
  assert.match(provider, /useHistoryEntryState<number \| null>\("global\.selected-location", null\)/);
  assert.match(reports, /<ReportFilterBar/);
  assert.match(reports, /apiParams=\{apiParams\}/);
  assert.match(reports, /creditComparisonFrames\.map\(\(frame\) => frame\.siteId\)/);
});