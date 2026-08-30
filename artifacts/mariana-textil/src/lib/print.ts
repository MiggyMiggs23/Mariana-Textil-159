const PRINT_ASSET_TIMEOUT_MS = 3_000;

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

export function absoluteAppUrl(path: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${basePath}${normalizedPath}`, window.location.origin).toString();
}