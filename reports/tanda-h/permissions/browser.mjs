import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from '../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs';

const root = process.cwd(), privateRoot = root + '/.local/tanda-h';
const out = root + '/reports/tanda-h/permissions', origin = 'http://127.0.0.1:43883';
const credentials = JSON.parse(fs.readFileSync(privateRoot + '/credentials.json'));
const results = [], lib = privateRoot + '/permissions-browser-libs';
fs.mkdirSync(lib, { recursive: true });
const packaged = '/nix/store/ifx1nl219iyd84hjr11rbkmjazsjr0q0-electronplayer-2.0.8-usr-target/lib';
for (const name of fs.readdirSync(packaged)) {
  if (!name.includes('.so') || /^(libc\.|libm\.|libpthread\.|librt\.|libdl\.|ld-|libresolv\.|libutil\.)/.test(name)) continue;
  if (!fs.existsSync(lib + '/' + name)) fs.symlinkSync(packaged + '/' + name, lib + '/' + name);
}
const pages = [
  { path: '/directorio/camionetas', module: 'camionetas', editRow: 'TANDA H PERMISSIONS VAN' },
  { path: '/directorio/choferes', module: 'choferes', editButton: 'Editar TANDA H PERMISSIONS DRIVER' },
  { path: '/equipos', module: 'equipos', editButton: 'Editar TANDA-H-PERMISSIONS' },
  { path: '/permisos', module: 'permisos' },
  { path: '/clientes/8', module: 'clientes_finanzas' },
];
const deadline = Date.now() + 180000;
for (const role of ['admin', 'terminal', 'caja', 'supervisor', 'bodega', 'sistemas', 'contador']) {
  assert(Date.now() < deadline, 'Bounded browser tranche expired');
  const browser = await chromium.launch({ headless: true, executablePath: root + '/.cache/ms-playwright/chromium-1187/chrome-linux/chrome', env: { ...process.env, LD_LIBRARY_PATH: lib }, args: ['--no-sandbox'], timeout: 15000 });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
    page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(12000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/login');
    await page.getByLabel('Usuario', { exact: true }).fill(credentials[role].username);
    await page.getByLabel('Contraseña', { exact: true }).fill(credentials[role].password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL(url => !url.pathname.includes('login'));
    const auth = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me');
      return { status: response.status, data: await response.json() };
    });
    assert.equal((auth.data.user ?? auth.data).rol, role.toUpperCase(), JSON.stringify({ status: auth.status, keys: Object.keys(auth.data), error: auth.data.error }));
    for (const target of pages.filter(p => ['admin', 'contador', 'sistemas'].includes(role) || ['permisos', 'clientes_finanzas'].includes(p.module))) {
      const item = { role: role.toUpperCase(), ...target, campaignObservationId: `tanda-h:permissions:ui:${role}:${target.module}`, authHttp: auth.status, qualification: 'UI observation only; outer-denied API does not prove selected action.' };
      try {
        await page.goto(origin + target.path);
        await page.waitForFunction(() => !document.body.innerText.includes('Comprobando sesión') && !document.body.innerText.includes('Cargando...'), {}, { timeout: 8000 });
        await page.waitForTimeout(650);
        item.actualPath = new URL(page.url()).pathname;
        item.visibleButtons = await page.getByRole('button').allTextContents();
        if (target.editRow || target.editButton) {
          const edit = target.editButton ? page.getByRole('button', { name: new RegExp('^' + target.editButton + '$', 'i') }).first() : page.getByRole('row').filter({ hasText: new RegExp(target.editRow, 'i') }).getByRole('button').first();
          item.editVisible = await edit.isVisible();
          if (item.editVisible) {
            await edit.click();
            item.actualEditClicked = true;
            item.dialogVisible = await page.getByRole('dialog').isVisible();
          }
        }
        if (target.module === 'permisos') {
          item.checkboxes = await page.getByRole('checkbox').count();
          item.disabledCheckboxes = await page.locator('[role=checkbox][disabled]').count();
          // Never toggle permissions, including positive controls.
        }
        item.screenshot = `ui-${role}-${target.module}.jpg`;
        await page.screenshot({ path: out + '/' + item.screenshot, fullPage: true });
        item.bodyExcerpt = (await page.locator('body').innerText()).slice(0, 1000);
        if (item.dialogVisible) await page.keyboard.press('Escape');
      } catch (error) { item.error = String(error); }
      results.push(item);
      fs.writeFileSync(out + '/browser-results.json', JSON.stringify(results, null, 2) + '\n');
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ roles: new Set(results.map(r => r.role)).size, observations: results.length, actualEditClicks: results.filter(r => r.actualEditClicked).length, errors: results.filter(r => r.error).length }));