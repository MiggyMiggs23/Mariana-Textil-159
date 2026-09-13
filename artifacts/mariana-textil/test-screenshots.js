import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Intercept the API requests to return mock data
  await page.route('**/api/users/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        username: "test",
        nombre: "Test User",
        rol: "ADMIN",
        permisos: { "SALIDAS": ["crear", "ver", "cancelar"] }
      })
    });
  });

  await page.route('**/api/ubicaciones-salida', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, nombre: "Origen 1" },
        { id: 2, nombre: "Destino 2" }
      ])
    });
  });
  
  await page.route('**/api/users', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/productos', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.route('**/api/salidas*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 1,
            folioFormateado: "SAL-0001",
            createdAt: new Date().toISOString(),
            nombreOrigen: "Tienda Centro",
            nombreDestino: "Bodega Norte",
            modalidad: "TRASLADO",
            estado: "ARMANDO",
            totalCantidadSolicitada: 15,
            totalCantidadEnviada: 15,
            nombreArmadoPor: "Juan",
          },
          {
            id: 2,
            folioFormateado: "SAL-0002",
            createdAt: new Date().toISOString(),
            nombreOrigen: "Tienda Centro",
            clienteId: 50,
            nombreCliente: "Juan Perez",
            modalidad: "VENTA_CLIENTE",
            estado: "EN_TRANSITO",
            totalCantidadSolicitada: 10,
            totalCantidadEnviada: 8,
            nombreArmadoPor: "Pedro",
          },
          {
            id: 3,
            folioFormateado: "SAL-0003",
            createdAt: new Date().toISOString(),
            nombreOrigen: "Tienda Centro",
            nombreDestino: "Bodega Sur",
            modalidad: "TRASLADO",
            estado: "CANCELADA",
            totalCantidadSolicitada: 20,
            totalCantidadEnviada: 0,
            nombreArmadoPor: "Ana",
          }
        ],
        total: 3,
        page: 1,
        pageSize: 100
      })
    });
  });

  console.log("Navigating to http://localhost:80/salidas...");
  await page.goto('http://localhost:80/salidas');
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/salidas-desktop.png' });
  console.log("Desktop screenshot saved to /tmp/salidas-desktop.png");

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/salidas-mobile.png' });
  console.log("Mobile screenshot saved to /tmp/salidas-mobile.png");

  await browser.close();
})();