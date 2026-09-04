const PRINT_ASSET_TIMEOUT_MS = 3_000;
const CSS_PX_PER_MM = 96 / 25.4;
const THERMAL_VERTICAL_MARGIN_MM = 8;
const THERMAL_HEIGHT_SAFETY_MM = 0.5;
const THERMAL_STYLE_ID = "thermal-ticket-page-sizes";

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function withTimeout(promise: Promise<unknown>): Promise<void> {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      window.setTimeout(resolve, PRINT_ASSET_TIMEOUT_MS),
    ),
  ]).then(() => undefined);
}

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await withTimeout(
      new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      }),
    );
  }
  if (typeof image.decode === "function") {
    await withTimeout(image.decode().catch(() => undefined));
  }
}

export async function waitForPrintableAssets(
  root: ParentNode = document,
): Promise<void> {
  const fontsReady = document.fonts?.ready;
  if (fontsReady) await withTimeout(fontsReady);
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(waitForImage),
  );
  await nextPaint();
}

export async function printWhenReady(bodyClass?: string): Promise<void> {
  if (bodyClass) document.body.classList.add(bodyClass);

  const cleanup = () => {
    if (bodyClass) document.body.classList.remove(bodyClass);
  };

  try {
    await waitForPrintableAssets();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    window.setTimeout(cleanup, 1_000);
  }
}

export function buildThermalPageRules(heightsPx: readonly number[]): string {
  return heightsPx
    .map((heightPx, index) => {
      const contentHeightMm =
        Math.ceil((heightPx / CSS_PX_PER_MM) * 10) / 10;
      const pageHeightMm =
        contentHeightMm +
        THERMAL_VERTICAL_MARGIN_MM +
        THERMAL_HEIGHT_SAFETY_MM;
      return `@page thermal-page-${index} { size: 80mm ${pageHeightMm.toFixed(1)}mm; margin: 4mm; }`;
    })
    .join("\n");
}

export async function prepareThermalTicketPages(
  root: HTMLElement,
): Promise<() => void> {
  document.body.classList.add("measure-thermal-ticket");
  try {
    await waitForPrintableAssets(root);

    const pages = Array.from(
      root.querySelectorAll<HTMLElement>("[data-thermal-page]"),
    );
    if (pages.length === 0) {
      throw new Error("No se encontraron páginas térmicas para imprimir.");
    }

    const previousStyle = document.getElementById(THERMAL_STYLE_ID);
    previousStyle?.remove();

    const heights = pages.map((page, index) => {
      page.style.setProperty("page", `thermal-page-${index}`);
      return Math.max(page.getBoundingClientRect().height, page.scrollHeight);
    });
    const style = document.createElement("style");
    style.id = THERMAL_STYLE_ID;
    style.textContent = buildThermalPageRules(heights);
    document.head.appendChild(style);

    return () => {
      pages.forEach((page) => page.style.removeProperty("page"));
      style.remove();
    };
  } finally {
    document.body.classList.remove("measure-thermal-ticket");
  }
}

export async function printThermalTicket(root: HTMLElement): Promise<void> {
  document.body.classList.add("print-80mm");
  let cleanupPages: (() => void) | undefined;
  const cleanup = () => {
    cleanupPages?.();
    cleanupPages = undefined;
    document.body.classList.remove("print-80mm");
  };

  try {
    cleanupPages = await prepareThermalTicketPages(root);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    window.setTimeout(cleanup, 1_000);
  }
}

export function absoluteAppUrl(path: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${basePath}${normalizedPath}`, window.location.origin).toString();
}