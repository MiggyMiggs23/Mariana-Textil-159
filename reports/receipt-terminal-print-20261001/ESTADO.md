# Recibos E3/E5 — cierre acotado, 02/10/2026

## Estado servido

**Activado por MAIN; sin publicación externa.** API y web sirven `dist-receipt-terminal-print-20261001`, copias byte-exactas de los binarios revision-2. El compuesto revision-3 añade la migración SQL documental, sin recompilar ni incluir HEAD ajeno. MAIN comunicó workflows validados, guardas SHA correctas y un reinicio controlado; PID API observado 16620 (`API_INSPECTION_BOOT=1`) y web 20329. Estos datos operativos proceden del cierre de MAIN, no de una nueva inspección del worker.

- API SHA256: `f29032a0b172fb6a53d86be1cd80da3b27faf91ceb5a500d262b20e2b79aff0a`.
- Manifest binario: `revision-2/build-manifest.json`, SHA256 `889ac50564e5cff92129df60d467e864748105079d07dfb742b0c3ce7b262a09`.
- Procedencia de copiado exacto: `release-staging.json`; guardas activas: `release-api.sha256`, `release-web.sha256`.
- Aplicación viva: `permission-applied.json`, **COMMITTED**. Se insertaron sólo 7 filas de `recibos_abonos`: ADMIN/TERMINAL ver=true; BODEGA/CAJA/CONTADOR/SISTEMAS/SUPERVISOR ver=false; otras acciones=false en los defaults. El bypass efectivo histórico de ADMIN no se eliminó.
- Personalizaciones de rol existentes, filas usuario/sitio y demás módulos preservados; `noOtherPermissionRowsChanged=true`.
- Guarda instalada: `fe3f1b3b070c48c0deac7c1f0d7c8281c7262b1cf131fa8c44f287f8fdedcbab`; `otherFunctionsAndAllTriggersUnchanged=true`.

Los estados «BUILT_NOT_ACTIVATED», «STAGED_NOT_ACTIVATED» y la preparación revision-3 en archivos anteriores corresponden a sus momentos de generación; se conservan, no se reescriben como PASS posteriores. Este documento y el encabezado de replit.md registran el cierre actual.

## Alcance funcional y frontera

`recibos_abonos.ver` controla búsqueda, descubrimiento, consulta e impresión/reimpresión de recibos documentales E3/E5. No es una nueva lista rígida de roles. Precedencia conservada: usuario > rol personalizado > sitio > rol heredado > denegar. No ADMIN sólo accede al sitio asignado, aun con TODAS; sin asignación se deniega. E5 no ADMIN exige recibo original y recepción persistida CAJA; no abre constancias financieras.

La guarda HTTP y la guarda SQL deben coincidir en el camino de impresión. Se detectó y corrigió un defecto real: `e5_insert_authority` aún exigía ADMIN al INSERT en `e5_impresiones`. La nueva rama exige actor activo, permiso efectivo, sitio asignado, recibo original CAJA e intención IMPRIMIR coherente. Su SQL conserva íntegro el cuerpo financiero anterior, incluida la excepción E11 existente. No se desactivó ningún trigger.

No se conceden recepción, preparación, autorización, aplicación, devoluciones monetarias ni otras APIs financieras por este permiso. Autorizar/aplicar dinero dirigido o retenido sigue reservado a ADMIN; se conserva el perímetro global E11. Recibos históricos sin evidencia suficiente permanecen bloqueados: sin reconstrucción con saldos actuales, sin cambiar folios/snapshots, sin limpieza de pruebas viejas.

El instalador explícito `lib/db/src/lib/receipt-print-authority.mjs` finaliza nuevas instalaciones financieras E5/E11; el bootstrap actual de recibos lo invoca después de la cadena histórica. El arranque normal no reinstala funciones E5 ni vuelve a introducir la guarda antigua.

## Evidencia ejecutada: dos niveles, sin mezclar

Base de rutas de ensayo: `reports/receipt-terminal-runtime-20261001/run-vd201X/`.

**1. Digital / API / PostgreSQL / navegador MAIN:**

- `remainder-rjBxgw/result.json`: `PASS_DIGITAL_ASSERTIONS_RASTER_REVIEW_REQUIRED`, `financialUnchanged=true`, `auditDeltaPassed=true`; MAIN comunicó exit 0.
- Continuación explícita `--skip-terminal-e3`: omitió sólo las dos primeras impresiones TERMINAL E3 ya válidas en `remainder-Acdx0k/result.json`. Ese ensayo anterior es **FAIL global** por fallo posterior E5; no se relabela como PASS.
- Resto final: 10 impresiones digitales de 2 páginas cada una. TERMINAL imprimió/reimprimió E5 dirigido y retenido; ADMIN y CAJA con concesión explícita imprimieron E3/E5; TERMINAL recuperó E3/E5 tras restaurar el permiso.
- Permiso explícito denegado y revocación TERMINAL: listados 403, GET/POST documentales 403 y UI sin botón de impresión. Sesiones frescas usadas para verificar cambios de permiso.
- Sitio ajeno E3/E5: GET y POST 404, sin metadata; además aserciones de ausencia en listados/búsquedas y UI. Pruebas montadas cubren TODAS y falta de sitio asignado; **no se afirma una prueba de navegador aislada sin sitio**, ni un INSERT SQL negativo independiente para cada combinación.
- `caja-e5-admin-boundary.json`: autorización por CAJA 403 y recepción con aplicación inmediata por no ADMIN 403. Se demuestra esa frontera negativa; no se atribuye a esta continuación una aplicación financiera positiva ADMIN que no ejecutó.
- Comparación financiera exacta con la línea base posrecepción original, incluidos triggers, sin normalizar/omitir campos. La corrección de función tiene comprobantes separados antes/después: `receipt-print-guard-1790900480221.json`. Auditoría previa se conserva y se separa del delta de solicitudes esperado.
- Pruebas previas del candidato: 4 backend, 1 defaults, 4 UI montada; typechecks/builds aprobados. Prueba offline del instalador explícito: 1/1.

**2. Visual / papel:**

- MAIN comunicó revisión visual limpia de las dos páginas E5 dirigido y de la primera página E3. No equivale a revisión humana de todas las páginas producidas.
- PDF E5 dirigido: `remainder-rjBxgw/terminal-browser-e5-directed-1.pdf` y `terminal-browser-e5-directed-2.pdf`.
- PDF E5 retenido: `remainder-rjBxgw/terminal-browser-e5-retained-1.pdf` y `terminal-browser-e5-retained-2.pdf`.
- E3 TERMINAL original: `remainder-Acdx0k/terminal-browser-e3-1.pdf` y `terminal-browser-e3-2.pdf`.
- E3 tras restaurar permiso: `remainder-rjBxgw/terminal-restored-e3.pdf`. Los raster conservan el mismo prefijo con `-raster-1.png` / `-raster-2.png`.
- La instrumentación MAIN sustituyó `window.print` y difirió sólo la limpieza de la clase real E5 para capturar el PDF nativo. No inyectó CSS, no forzó permisos/botones y no usó debugger/CDP para alterar el documento.
- **No hubo PASS del testing agent:** se abandonó su sesión instrumentalizada y se completó un ensayo MAIN acotado con corrección del defecto SQL real. Ninguna evidencia demuestra salida física de papel.

## Límites y conservación

No se efectuaron cobros, abonos, aplicaciones o devoluciones sobre datos reales para probar la funcionalidad. Recepciones y documentos de ensayo fueron sintéticos en PostgreSQL desechable; la continuación no creó nuevos recibos. El cambio vivo fue exclusivamente defaults y función autorizados. No se afirma auditoría exhaustiva de todos los roles/permisos, ni reapertura de la campaña de matriz pausada por el propietario.

Los binarios previos, los ensayos fallidos, PDFs y snapshots permanecen conservados. El worker de implementación/documentación no accedió a appDB, no inició workflows ni inspeccionó logs en este cierre.