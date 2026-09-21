# Preparación aislada — resultados y detención

## Alcance y estado

Fuente exacta: `31804125a1e752bde128d72e9fd44d23972ffff1`.
Árbol: `6337df3ae1dc67b8de91fabda3cbf73dd255cf59`.
Exportación: `/tmp/e2-release-preparation-adkcNR/source`.
No se modificó esa fuente; los paquetes internos resuelven dentro de la
exportación, y las dependencias externas instaladas se reutilizan por enlaces.
Los procesos se lanzaron con `env -i`, permitiendo solo PATH, HOME aislado,
LANG y, para pruebas, NODE_ENV=test y una URL centinela inalcanzable sin secretos.
No se exportaron archivos `.env`. No se importó ni ejecutó la aplicación.

La primera preparación abortó antes de compilar por el límite de buffer de
`git archive` (ENOBUFS). Se sustituyó el transporte en memoria por un archivo
tar en `/tmp`; no se atribuye ningún resultado de pruebas a ese primer intento.

## Entradas y arrastre

Se conserva la aclaración literal del propietario en `aclaracion-entradas.txt`.
Frente a la fuente retenida `7cb77f8cfc6287fa51325a25122c48af392a7ada`,
el cambio de `pages/entradas.tsx` afecta a la presentación del modal.
No cambia el submit, payload, hooks API, ruta de creación de Entradas ni
contrato generado. El atajo llena cantidades por rollo; no sustituye sus
cantidades/series individuales. No se encontró dependencia nueva de API.
Entradas es frontend: no se ha compilado ni sustituido su bundle.

La consulta de inventario con `p.activo=true` corresponde a E8
(`reports/prompt-u-plan-de-implementacion.md`, sección E8). Los cambios de
etiquetas de Ventas/Cobranza corresponden a E6. Los cambios de matriz de
remate están bajo `REMATE_MATRIX_RELEASED=false` / `REMATE_UI_RELEASED`.
Remate, piso de precio y borrado de producto permanecen preparados/apagados.
El inventario inicial de rutas está en
`anexos/inventario-diferencias-fuentes.txt`; no se confunden tests con runtime.
No se encontró un segundo arrastre de negocio fuera del alcance en esa revisión.

## Resultados efectivamente ejecutados

| Verificación | Resultado terminal |
|---|---|
| Typecheck raíz de la exportación (`pnpm run typecheck`) | exit 0; todos los paquetes seleccionados completaron; 0 diagnósticos |
| Build API de la exportación (`node artifacts/api-server/build.mjs`) | exit 0 |
| Selección explícita `no-db-manifest.txt`, guard offline y loader TSX | exit 1; 119 tests, 114 PASS, 5 FAIL |
| Registrador / wrapper candidato | No ejecutado |
| PostgreSQL nuevo desechable / preflight completo | No ejecutado; no se inició ningún cluster |

Los logs y códigos terminales completos están en `verificacion/`.
El manifiesto de pruebas no permite descubrimiento implícito; se usó
`scripts/src/offline-test-guard.cjs` de la exportación para bloquear red.

### Cinco fallos que impiden declarar el candidato verificado

1. `credit-refund.safe.test.ts`: la aserción del DDL sigue buscando la
   comparación histórica de `source_xid` con `txid_current() % 4294967296`,
   mientras el SQL de la revisión fijada usa la procedencia xid8.
2. `limited-startup-preflight.test.ts`: el caso de inventario A+C combinado
   termina en `A+C evidence column metadata mismatch`.
3. En esa misma suite, el caso positivo de preflight termina en
   `A+C evidence column mismatch`.
4. El negativo del trigger permanente E1 esperaba el error de inventario
   E1 pero se detiene antes por las columnas A+C.
5. El negativo de la guarda E1P01 esperaba su error específico pero se
   detiene antes por las columnas A+C.

La inspección muestra fixtures/assertions anteriores a la procedencia xid8;
no se interpreta eso como cinco defectos de producción ni como cinco PASS.
No se cambian los tests de la revisión exacta ni el SQL aprobado para obtener
un verde. Hace falta resolver cómo verificar esos casos conservando la fuente
fijada antes de declarar completo y liberable el paquete.

## Artefactos medidos, no autorizados para instalar

- Bundle `candidato/dist/index.mjs`:
  `f22be73ed8c17ed96d6f22cd62a126bf965a59c55781446fcd1a03c8c16e002c`.
- Lockfile de la fuente:
  `a7a54d756eb12b9f33e6bec8d70872026de72bee9567aa640a021324a0fcbc6d`.
- SQL instalación:
  `3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c`.
- SQL reversión:
  `0f5952b874bb9fead4f782b9b169636564d302f00f20d5e4bf135896c9b32b3c`.
- SQL preflight parcial A+C:
  `b368c7239f83b088d1fa5c30d1c1d0dd08538842d18a694315bd88b7f1e5980c`.

Se conservaron bundle, mapas, workers y fuentes tipográficas juntos.
No hay hash inventado de preflight completo o wrapper final: no están listos.
`reconstruct-catalog-fixture.mjs` únicamente preparó en `/tmp` un SQL de
fixture vacío desde metadatos archivados; no fue ejecutado, no usa datos de
negocio ni constituye una validación o respaldo.

## Límites y siguiente decisión

No se accedió a la base de la API ni a clones E1/E10; no se cambió workflow,
API activa, bundle servido, permisos, banderas o SQL operativo. Se conservó
intacto el informe previamente modificado de corrección SQL/arranques.

La ventana aprobada sigue siendo domingo 27 de septiembre de 2026, con hora
por llenar. El respaldo futuro debe quedar verificado en Google Drive antes
del SQL, junto con una recuperación ensayada y el bundle retenido; no se hizo
respaldo ahora. El primer cierre corresponde al propietario en Mariana con
tickets de prueba en efectivo y transferencia; la purga es futura.

No se emite una fase B lista para autorizar: faltan verificaciones técnicas
reales, no una autorización para reiniciar ni para corregir las fuentes.